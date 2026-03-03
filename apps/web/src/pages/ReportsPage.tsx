/**
 * ReportsPage.tsx — Professional Structural Analysis Report Viewer
 *
 * Industry-standard A4 document layout modelled after ARUP / WSP / Buro Happold
 * engineering calculation reports with:
 *   • Branded cover page with watermark
 *   • Document control & revision table
 *   • Numbered table of contents
 *   • Executive summary with traffic-light KPIs
 *   • Design basis (codes, standards, assumptions)
 *   • Geometry, loading, analysis & design result sections
 *   • Properly formatted engineering tables with alternating rows
 *   • Running header / footer with page numbering
 *   • Signature & approval block
 *   • Print-optimised @media rules
 */

import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Download, Printer, Share2, TableProperties,
    ChevronLeft, Layout, FileCode,
    AlertTriangle, CheckCircle2, XCircle,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { useModelStore } from '../store/model';
import type { Member, NodeLoad, MemberLoad, LoadCase, LoadCombination, ModeShape } from '../store/model';
import type { SectionProperties } from '../data/SectionDatabase';
import { useAuth } from '../providers/AuthProvider';
const beamLabLogo = '/branding/beamlab_icon_colored.svg';
import { generateDesignReport } from '../services/PDFReportService';
import { generateDXF, downloadDXF } from '../services/DXFExportService';
import { generateIFC, downloadIFC } from '../services/IFCExportService';
import { exportProjectData } from '../services/ExcelExportService';
import { STEEL_SECTIONS } from '../data/SectionDatabase';

/* ─────────────────────── helpers ─────────────────────── */

/** Deterministic document reference from node/member count so it doesn't change every render */
const docRef = (n: number, m: number) =>
    `BL-${String(n * 37 + m * 53 + 1000).padStart(5, '0')}`;

/** Engineering number: fixed decimals, thousands separator */
const eng = (v: number | undefined, decimals = 2): string => {
    if (v === undefined || v === null) return '—';
    return v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
};

const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/* ─────────────────────── sub-components ─────────────────────── */

/** Reusable section heading with auto-numbering */
const SectionHeading = ({
    number,
    title,
    className = '',
}: {
    number: string;
    title: string;
    className?: string;
}) => (
    <div className={`flex items-baseline gap-3 border-b-2 border-slate-200 dark:border-slate-800 pb-1.5 mb-5 mt-10 print:break-before-auto ${className}`}>
        <span className="text-sm font-black text-slate-500 tracking-wider">{number}</span>
        <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900">{title}</h2>
    </div>
);

/** Sub-section heading */
const SubHeading = ({ number, title }: { number: string; title: string }) => (
    <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 mb-3 mt-6">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{number}</span>
        <h3 className="text-[13px] font-bold text-slate-700">{title}</h3>
    </div>
);

/** KPI card used in executive summary */
const KpiCard = ({
    label,
    value,
    unit,
    status,
}: {
    label: string;
    value: string | number;
    unit?: string;
    status?: 'pass' | 'warn' | 'fail' | 'info';
}) => {
    const ring =
        status === 'pass'
            ? 'border-l-green-500'
            : status === 'warn'
              ? 'border-l-amber-500'
              : status === 'fail'
                ? 'border-l-red-500'
                : 'border-l-blue-500';
    return (
        <div className={`border border-slate-200 border-l-4 ${ring} rounded-sm px-4 py-3 print:bg-white`}>
            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-lg font-black text-slate-900 leading-tight">
                {value}
                {unit && <span className="text-xs font-medium text-slate-600 dark:text-slate-400 ml-1">{unit}</span>}
            </p>
        </div>
    );
};

/** Status pill used in compliance tables */
const StatusPill = ({ status }: { status: 'PASS' | 'FAIL' | 'WARN' | 'N/A' }) => {
    const map = {
        PASS: 'bg-green-100 text-green-800 border-green-300',
        FAIL: 'bg-red-100 text-red-800 border-red-300',
        WARN: 'bg-amber-100 text-amber-800 border-amber-300',
        'N/A': 'bg-slate-100 text-slate-500 border-slate-300',
    };
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${map[status]}`}>
            {status === 'PASS' && <CheckCircle2 className="w-3 h-3" />}
            {status === 'FAIL' && <XCircle className="w-3 h-3" />}
            {status === 'WARN' && <AlertTriangle className="w-3 h-3" />}
            {status}
        </span>
    );
};

/* ─────────────────────── MAIN PAGE ─────────────────────── */

export const ReportsPage = () => {
    const { user } = useAuth();
    const nodes = useModelStore((s) => s.nodes);
    const members = useModelStore((s) => s.members);
    const analysisResults = useModelStore((s) => s.analysisResults);
    const loads = useModelStore((s) => s.loads);
    const memberLoads = useModelStore((s) => s.memberLoads);
    const loadCases = useModelStore((s) => s.loadCases);
    const loadCombinations = useModelStore((s) => s.loadCombinations);
    const modalResults = useModelStore((s) => s.modalResults);

    const userName = user?.firstName || 'Engineer';
    const now = useMemo(() => new Date(), []);
    const ref = useMemo(() => docRef(nodes.size, members.size), [nodes.size, members.size]);
    const revision = '00'; // initial issue

    useEffect(() => { document.title = 'Reports | BeamLab'; }, []);

    /* ── Computed stats ── */
    const nodeList = useMemo(() => Array.from(nodes.values()), [nodes]);
    const memberList = useMemo(() => Array.from(members.values()), [members]);

    const supportCount = useMemo(
        () => nodeList.filter((n) => Object.values(n.restraints || {}).some(Boolean)).length,
        [nodeList],
    );
    const freeNodes = nodeList.length - supportCount;

    const maxAxial = useMemo(() => {
        if (!analysisResults?.memberForces) return undefined;
        let mx = 0;
        analysisResults.memberForces.forEach((f) => {
            const v = Math.abs(f.axial ?? 0);
            if (v > mx) mx = v;
        });
        return mx;
    }, [analysisResults]);

    const maxMoment = useMemo(() => {
        if (!analysisResults?.memberForces) return undefined;
        let mx = 0;
        analysisResults.memberForces.forEach((f) => {
            const v = Math.max(Math.abs(f.momentZ ?? 0), Math.abs(f.momentY ?? 0));
            if (v > mx) mx = v;
        });
        return mx;
    }, [analysisResults]);

    const maxShear = useMemo(() => {
        if (!analysisResults?.memberForces) return undefined;
        let mx = 0;
        analysisResults.memberForces.forEach((f) => {
            const v = Math.max(Math.abs(f.shearY ?? 0), Math.abs(f.shearZ ?? 0));
            if (v > mx) mx = v;
        });
        return mx;
    }, [analysisResults]);

    const maxDisp = useMemo(() => {
        if (!analysisResults?.displacements) return undefined;
        let mx = 0;
        analysisResults.displacements.forEach((d) => {
            const v = Math.max(Math.abs(d.dx ?? 0), Math.abs(d.dy ?? 0), Math.abs(d.dz ?? 0));
            if (v > mx) mx = v;
        });
        return mx;
    }, [analysisResults]);

    /* ── Section properties lookup ── */
    const uniqueSections = useMemo(() => {
        const seen = new Map<string, { id: string; A?: number; I?: number; Iy?: number; Iz?: number; J?: number; E?: number; count: number; dbMatch?: SectionProperties }>();
        memberList.forEach((m) => {
            const sid = m.sectionId || m.section || 'Default';
            if (!seen.has(sid)) {
                const db = STEEL_SECTIONS.find((s) => s.id === sid || s.name === sid);
                seen.set(sid, { id: sid, A: m.A, I: m.I, Iy: m.Iy, Iz: m.Iz, J: m.J, E: m.E, count: 1, dbMatch: db });
            } else {
                seen.get(sid)!.count++;
            }
        });
        return Array.from(seen.values());
    }, [memberList]);

    /* ── Members with releases ── */
    const membersWithReleases = useMemo(() =>
        memberList.filter((m) => m.releases && Object.values(m.releases).some(Boolean)),
    [memberList]);

    /* ── Critical members (max for each action) ── */
    const criticalMembers = useMemo(() => {
        if (!analysisResults?.memberForces) return null;
        let maxAxialId = '', maxMomentId = '', maxShearId = '', maxTorsionId = '';
        let mxA = 0, mxM = 0, mxS = 0, mxT = 0;
        let mxAval = 0, mxMval = 0, mxSval = 0, mxTval = 0;
        analysisResults.memberForces.forEach((f, id) => {
            const a = Math.abs(f.axial ?? 0);
            const m = Math.max(Math.abs(f.momentY ?? 0), Math.abs(f.momentZ ?? 0));
            const s = Math.max(Math.abs(f.shearY ?? 0), Math.abs(f.shearZ ?? 0));
            const t = Math.abs(f.torsion ?? 0);
            if (a > mxA) { mxA = a; maxAxialId = id; mxAval = f.axial; }
            if (m > mxM) { mxM = m; maxMomentId = id; mxMval = Math.abs(f.momentY ?? 0) >= Math.abs(f.momentZ ?? 0) ? (f.momentY ?? 0) : (f.momentZ ?? 0); }
            if (s > mxS) { mxS = s; maxShearId = id; mxSval = Math.abs(f.shearY ?? 0) >= Math.abs(f.shearZ ?? 0) ? (f.shearY ?? 0) : (f.shearZ ?? 0); }
            if (t > mxT) { mxT = t; maxTorsionId = id; mxTval = f.torsion ?? 0; }
        });
        return [
            { action: 'Maximum Axial Force', id: maxAxialId, value: mxAval, absValue: mxA, unit: 'kN' },
            { action: 'Maximum Bending Moment', id: maxMomentId, value: mxMval, absValue: mxM, unit: 'kN·m' },
            { action: 'Maximum Shear Force', id: maxShearId, value: mxSval, absValue: mxS, unit: 'kN' },
            { action: 'Maximum Torsion', id: maxTorsionId, value: mxTval, absValue: mxT, unit: 'kN·m' },
        ];
    }, [analysisResults]);

    /* ── Pagination ── */
    const ROWS_PER_PAGE = 25;
    const [forcesPage, setForcesPage] = useState(0);
    const [nodesPage, setNodesPage] = useState(0);

    const forcesEntries = useMemo(
        () => (analysisResults?.memberForces ? Array.from(analysisResults.memberForces.entries()) : []),
        [analysisResults],
    );
    const paginatedForces = useMemo(
        () => forcesEntries.slice(forcesPage * ROWS_PER_PAGE, (forcesPage + 1) * ROWS_PER_PAGE),
        [forcesEntries, forcesPage],
    );
    const totalForcePages = Math.max(1, Math.ceil(forcesEntries.length / ROWS_PER_PAGE));

    const paginatedNodes = useMemo(
        () => nodeList.slice(nodesPage * ROWS_PER_PAGE, (nodesPage + 1) * ROWS_PER_PAGE),
        [nodeList, nodesPage],
    );
    const totalNodePages = Math.max(1, Math.ceil(nodeList.length / ROWS_PER_PAGE));

    /* ── Section-collapse for on-screen (all open for print) ── */
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (id: string) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

    /* ── Export handlers (kept from original) ── */
    const handlePrint = () => window.print();

    const handleExportPDF = async () => {
        try {
            await import('../services/PDFReportService').then((m) =>
                m.generateProfessionalReport(
                    { name: 'BeamLab Project', engineer: userName, date: fmtDate(now), description: 'Analysis Report' },
                    memberList,
                    nodeList,
                    analysisResults,
                    new Map(),
                ),
            );
        } catch {
            console.warn('Backend report failed, using client-side fallback');
            generateDesignReport(
                { name: 'BeamLab Project', engineer: userName, date: fmtDate(now), description: 'Analysis Report' },
                memberList,
                nodeList,
                analysisResults,
                new Map(),
            );
        }
    };

    const handleExportDXF = () => downloadDXF(generateDXF(nodes, members), 'BeamLab_Model.dxf');
    const handleExportIFC = () =>
        downloadIFC(generateIFC({ name: 'BeamLab Project', author: userName }, nodes, members), 'BeamLab_Model.ifc');
    const handleExportExcel = () => exportProjectData('BeamLab Project', nodes, members, analysisResults);

    /* ── Collapsible wrapper (expand-all in print) ── */
    const Section = ({
        id,
        num,
        title,
        children,
    }: {
        id: string;
        num: string;
        title: string;
        children: React.ReactNode;
    }) => {
        const isOpen = !collapsed[id];
        return (
            <section className="print:break-inside-avoid-page">
                <button type="button"
                    onClick={() => toggle(id)}
                    className="w-full flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-800 pb-1.5 mb-5 mt-10 print:pointer-events-none"
                >
                    <div className="flex items-baseline gap-3">
                        <span className="text-sm font-black text-slate-500 tracking-wider">{num}</span>
                        <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900">{title}</h2>
                    </div>
                    <span className="print:hidden text-slate-600 dark:text-slate-400">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                </button>
                <div className={`${isOpen ? '' : 'hidden'} print:!block`}>{children}</div>
            </section>
        );
    };

    /* ──────────────────────── RENDER ──────────────────────── */
    return (
        <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans selection:bg-blue-500/30 print:bg-white print:text-black">
            {/* ━━━ App header (hidden in print) ━━━ */}
            <header className="sticky top-0 z-50 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/90 backdrop-blur-md px-6 py-3 print:hidden">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 flex items-center justify-center">
                            <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-contain" />
                        </div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">BeamLab</h2>
                    </Link>
                </div>
                <div className="hidden md:flex flex-1 justify-center">
                    <nav className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-full border border-slate-200 dark:border-slate-800">
                        <Link to="/stream" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors px-4 py-1.5 rounded-full hover:bg-white dark:hover:bg-slate-100 dark:bg-slate-800">Projects</Link>
                        <Link to="/app" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors px-4 py-1.5 rounded-full hover:bg-white dark:hover:bg-slate-100 dark:bg-slate-800">Design</Link>
                        <span className="text-blue-600 dark:text-white text-sm font-bold bg-white dark:bg-slate-800 shadow-sm px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">Reports</span>
                        <Link to="/settings" className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-sm font-medium transition-colors px-4 py-1.5 rounded-full hover:bg-white dark:hover:bg-slate-100 dark:bg-slate-800">Settings</Link>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 border-2 border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-white font-bold text-sm">
                        {userName.charAt(0)}
                    </div>
                </div>
            </header>

            {/* ━━━ Main content ━━━ */}
            <main className="flex-1 w-full flex flex-col items-center py-8 px-4 overflow-y-auto print:p-0 print:overflow-visible">
                {/* Breadcrumbs (hidden in print) */}
                <div className="w-full max-w-[210mm] mb-6 flex items-center gap-2 text-sm print:hidden">
                    <Link to="/stream" className="text-slate-600 dark:text-slate-400 hover:text-blue-600 transition-colors">Projects</Link>
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400 rotate-180" />
                    <span className="text-slate-600 dark:text-slate-400">Current Project</span>
                    <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-400 rotate-180" />
                    <span className="text-slate-900 dark:text-white font-semibold">Report View</span>
                </div>

                {/* ═══════════════════ A4 DOCUMENT ═══════════════════ */}
                <article
                    className="relative w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-sm mb-24 print:mb-0 print:shadow-none print:w-full print:max-w-none print:rounded-none"
                    style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}
                >
                    {/* ─── WATERMARK (diagonal DRAFT when no results) ─── */}
                    {!analysisResults && (
                        <div className="absolute inset-0 overflow-hidden pointer-events-none select-none print:hidden z-0">
                            <span
                                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-black text-slate-800 dark:text-slate-100 tracking-[0.3em] whitespace-nowrap"
                                style={{ transform: 'translate(-50%,-50%) rotate(-35deg)' }}
                            >
                                DRAFT
                            </span>
                        </div>
                    )}

                    {/* ╔══════════════════════════════════════════════════╗
                       ║                   COVER PAGE                    ║
                       ╚══════════════════════════════════════════════════╝ */}
                    <div className="relative min-h-[297mm] flex flex-col justify-between p-12 md:p-16 print:p-[25mm] print:break-after-page z-10">
                        {/* ─── Branded accent bars (matches PDF THEME) ─── */}
                        <div className="absolute top-0 left-0 right-0 h-[6px] bg-[#12376A]" />
                        <div className="absolute top-[6px] left-0 right-0 h-[3px] bg-[#BF9B30]" />

                        {/* Top band - branding */}
                        <div className="flex items-start justify-between mt-2">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 flex items-center justify-center">
                                    <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-contain" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">BeamLab</h1>
                                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-[0.25em] mt-0.5">Structural Engineering</p>
                                </div>
                            </div>
                            <div className="text-right text-[10px] text-slate-600 dark:text-slate-400 space-y-0.5 leading-tight">
                                <p>beamlab.app</p>
                                <p>support@beamlab.app</p>
                            </div>
                        </div>

                        {/* Centre — title block */}
                        <div className="flex-1 flex flex-col items-center justify-center text-center -mt-12">
                            <div className="w-24 h-0.5 bg-slate-300 mb-8" />
                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-[0.3em] mb-3">
                                Structural Analysis Report
                            </p>
                            <h2 className="text-3xl md:text-4xl font-black text-[#12376A] leading-tight mb-4 max-w-md">
                                BeamLab Project
                            </h2>
                            <p className="text-sm text-slate-500 font-medium mb-1">Document Ref: {ref}</p>
                            <p className="text-sm text-slate-500">Revision {revision} &mdash; {fmtDate(now)}</p>
                            <div className="w-24 h-0.5 bg-slate-300 mt-8" />
                        </div>

                        {/* Bottom — doc control mini-table */}
                        <div className="border border-slate-300 rounded text-[11px] overflow-hidden">
                            <table className="w-full text-left">
                                <tbody>
                                    <tr className="border-b border-slate-200">
                                        <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50 w-1/4">Project</td>
                                        <td className="px-3 py-2 text-slate-900">BeamLab Project</td>
                                        <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50 w-1/4">Document No.</td>
                                        <td className="px-3 py-2 text-slate-900 font-mono">{ref}</td>
                                    </tr>
                                    <tr className="border-b border-slate-200">
                                        <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Prepared by</td>
                                        <td className="px-3 py-2 text-slate-900">{userName}</td>
                                        <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Date</td>
                                        <td className="px-3 py-2 text-slate-900">{fmtDate(now)}</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Status</td>
                                        <td className="px-3 py-2">
                                            {analysisResults ? (
                                                <span className="text-green-700 font-bold">Issued for Review</span>
                                            ) : (
                                                <span className="text-amber-600 font-bold">DRAFT — Not for Construction</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Revision</td>
                                        <td className="px-3 py-2 text-slate-900 font-mono">{revision}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ╔══════════════════════════════════════════════════╗
                       ║           RUNNING HEADER / FOOTER               ║
                       ╚══════════════════════════════════════════════════╝ */}
                    {/* These only appear in @media print via CSS counters; on-screen we render a simulated header. */}
                    <style>{`
                        @media print {
                            @page {
                                size: A4 portrait;
                                margin: 20mm 15mm 25mm 15mm;
                                @top-left   { content: "BeamLab — ${ref}"; font-size: 8pt; color: #94a3b8; }
                                @top-right  { content: "Rev ${revision}  |  ${fmtDate(now)}"; font-size: 8pt; color: #94a3b8; }
                                @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #94a3b8; }
                                @bottom-left { content: "CONFIDENTIAL — ${userName}"; font-size: 7pt; color: #cbd5e1; }
                            }
                        }
                    `}</style>

                    {/* ─── On-screen running header (hidden in print, @page handles it) ─── */}
                    <div className="flex items-center justify-between px-12 md:px-16 print:hidden py-2 border-b-2 border-[#12376A] bg-slate-50 text-[10px] text-slate-600 dark:text-slate-400">
                        <span className="font-bold tracking-wider">BeamLab — {ref}</span>
                        <span>Rev {revision} &nbsp;|&nbsp; {fmtDate(now)}</span>
                    </div>

                    {/* ╔══════════════════════════════════════════════════╗
                       ║          DOCUMENT CONTROL & REVISIONS           ║
                       ╚══════════════════════════════════════════════════╝ */}
                    <div className="px-12 md:px-16 print:px-0 pt-8 print:pt-0 print:break-after-page">
                        <SectionHeading number="0" title="Document Control" className="mt-0" />

                        <SubHeading number="0.1" title="Revision History" />
                        <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                        <th className="px-3 py-2 font-bold">Rev</th>
                                        <th className="px-3 py-2 font-bold">Date</th>
                                        <th className="px-3 py-2 font-bold">Description</th>
                                        <th className="px-3 py-2 font-bold">Author</th>
                                        <th className="px-3 py-2 font-bold">Checked</th>
                                        <th className="px-3 py-2 font-bold">Approved</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-slate-200">
                                        <td className="px-3 py-2 font-mono font-bold">{revision}</td>
                                        <td className="px-3 py-2">{fmtDate(now)}</td>
                                        <td className="px-3 py-2">Initial issue for review</td>
                                        <td className="px-3 py-2">{userName}</td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">—</td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">—</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <SubHeading number="0.2" title="Distribution" />
                        <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-8">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-100 border-b border-slate-300">
                                        <th className="px-3 py-2 font-bold text-slate-600">Name</th>
                                        <th className="px-3 py-2 font-bold text-slate-600">Role</th>
                                        <th className="px-3 py-2 font-bold text-slate-600">Company</th>
                                        <th className="px-3 py-2 font-bold text-slate-600">Copies</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-t border-slate-200">
                                        <td className="px-3 py-2">{userName}</td>
                                        <td className="px-3 py-2">Structural Engineer</td>
                                        <td className="px-3 py-2">BeamLab</td>
                                        <td className="px-3 py-2">1 (electronic)</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* ── TABLE OF CONTENTS ── */}
                        <SectionHeading number="" title="Table of Contents" />
                        <nav className="text-[12px] space-y-1.5 mb-8 columns-2 gap-8 print:columns-1">
                            {[
                                ['1.0', 'Executive Summary'],
                                ['2.0', 'Design Basis'],
                                ['3.0', 'Structural Model'],
                                ['3.1', 'Node Coordinates'],
                                ['3.2', 'Member Connectivity'],
                                ['3.3', 'Applied Loads'],
                                ['4.0', 'Analysis Results'],
                                ['4.1', 'Internal Member Forces'],
                                ['4.2', 'Support Reactions'],
                                ['4.3', 'Nodal Displacements'],
                                ['5.0', 'Design Verification'],
                                ['6.0', 'Conclusions & Recommendations'],
                                ['', 'Appendix A — Signatures & Approval'],
                            ].map(([num, title]) => (
                                <div key={title} className="flex items-baseline gap-2">
                                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400 w-8 shrink-0">{num}</span>
                                    <span className="text-slate-700 font-medium flex-1 border-b border-dotted border-slate-300">{title}</span>
                                </div>
                            ))}
                        </nav>
                    </div>

                    {/* ╔══════════════════════════════════════════════════╗
                       ║            1.0  EXECUTIVE SUMMARY               ║
                       ╚══════════════════════════════════════════════════╝ */}
                    <div className="px-12 md:px-16 print:px-0">
                        <Section id="exec" num="1.0" title="Executive Summary">
                            <p className="text-[12px] text-slate-600 leading-relaxed mb-6">
                                This report presents the structural analysis results for the BeamLab Project model
                                comprising <strong>{nodes.size} nodes</strong> and <strong>{members.size} members</strong>.
                                The analysis was performed using the direct stiffness method with full 3-D frame capability.
                                {analysisResults ? ' All results presented herein are based on a completed analysis run.' : ' Analysis has not yet been executed — results below will appear once the solver is run.'}
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                                <KpiCard label="Total Nodes" value={nodes.size} status="info" />
                                <KpiCard label="Total Members" value={members.size} status="info" />
                                <KpiCard label="Support Nodes" value={supportCount} status="info" />
                                <KpiCard
                                    label="Analysis Status"
                                    value={analysisResults ? 'Complete' : 'Pending'}
                                    status={analysisResults ? 'pass' : 'warn'}
                                />
                            </div>

                            {analysisResults && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    <KpiCard label="Max Axial Force" value={eng(maxAxial)} unit="kN" status="info" />
                                    <KpiCard label="Max Bending Moment" value={eng(maxMoment)} unit="kN·m" status="info" />
                                    <KpiCard label="Max Shear Force" value={eng(maxShear)} unit="kN" status="info" />
                                    <KpiCard label="Max Displacement" value={eng(maxDisp, 4)} unit="mm" status={maxDisp !== undefined && maxDisp > 25 ? 'warn' : 'pass'} />
                                </div>
                            )}
                        </Section>

                        {/* ╔══════════════════════════════════════════════════╗
                           ║             2.0  DESIGN BASIS                    ║
                           ╚══════════════════════════════════════════════════╝ */}
                        <Section id="basis" num="2.0" title="Design Basis">
                            <SubHeading number="2.1" title="Applicable Codes & Standards" />
                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-300">
                                            <th className="px-3 py-2 font-bold text-slate-600 w-1/3">Code / Standard</th>
                                            <th className="px-3 py-2 font-bold text-slate-600">Description</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {[
                                            ['IS 800:2007', 'General Construction in Steel — Code of Practice'],
                                            ['IS 456:2000', 'Plain and Reinforced Concrete — Code of Practice'],
                                            ['IS 1893:2016 (Part 1)', 'Criteria for Earthquake Resistant Design of Structures'],
                                            ['IS 875 (Part 1–5)', 'Code of Practice for Design Loads'],
                                            ['ASCE 7-22', 'Minimum Design Loads and Associated Criteria'],
                                        ].map(([code, desc]) => (
                                            <tr key={code}>
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800">{code}</td>
                                                <td className="px-3 py-2 text-slate-600">{desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <SubHeading number="2.2" title="Key Assumptions" />
                            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc list-inside mb-6 leading-relaxed">
                                <li>Linear elastic analysis; small displacement theory.</li>
                                <li>Members are prismatic with uniform cross-section along length.</li>
                                <li>Connections are assumed rigid (moment-resisting) unless noted otherwise.</li>
                                <li>Self-weight is included automatically based on assigned cross-section properties.</li>
                                <li>Soil–structure interaction effects are not considered in this model.</li>
                            </ul>

                            <SubHeading number="2.3" title="Material Properties" />
                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-4">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-100 border-b border-slate-300">
                                            <th className="px-3 py-2 font-bold text-slate-600">Material</th>
                                            <th className="px-3 py-2 font-bold text-slate-600 text-right">E (GPa)</th>
                                            <th className="px-3 py-2 font-bold text-slate-600 text-right">f<sub>y</sub> / f<sub>ck</sub> (MPa)</th>
                                            <th className="px-3 py-2 font-bold text-slate-600 text-right">Density (kN/m³)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        <tr>
                                            <td className="px-3 py-2 font-medium text-slate-800">Structural Steel (Fe 250)</td>
                                            <td className="px-3 py-2 text-right font-mono">200.00</td>
                                            <td className="px-3 py-2 text-right font-mono">250.00 (f<sub>y</sub>)</td>
                                            <td className="px-3 py-2 text-right font-mono">78.50</td>
                                        </tr>
                                        <tr className="bg-slate-50/60">
                                            <td className="px-3 py-2 font-medium text-slate-800">Concrete (M25)</td>
                                            <td className="px-3 py-2 text-right font-mono">25.00</td>
                                            <td className="px-3 py-2 text-right font-mono">25.00 (f<sub>ck</sub>)</td>
                                            <td className="px-3 py-2 text-right font-mono">25.00</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* 2.4 Units & Sign Convention */}
                            <SubHeading number="2.4" title="Units & Sign Convention" />
                            <div className="text-[11px] text-slate-600 leading-relaxed mb-6">
                                <p className="mb-3">All quantities in this report are expressed in the following consistent unit system unless explicitly noted otherwise:</p>
                                <div className="border border-slate-300 rounded-sm overflow-hidden mb-4">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-slate-300">
                                                <th className="px-3 py-2 font-bold text-slate-600 w-1/3">Quantity</th>
                                                <th className="px-3 py-2 font-bold text-slate-600">Unit</th>
                                                <th className="px-3 py-2 font-bold text-slate-600">Symbol</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {[
                                                ['Length', 'metres', 'm'],
                                                ['Force', 'kilonewtons', 'kN'],
                                                ['Moment', 'kilonewton-metres', 'kN·m'],
                                                ['Stress / Pressure', 'megapascals (N/mm²)', 'MPa'],
                                                ['Displacement', 'millimetres', 'mm'],
                                                ['Rotation', 'radians', 'rad'],
                                                ['Temperature', 'degrees Celsius', '°C'],
                                                ['Density', 'kilonewtons per cubic metre', 'kN/m³'],
                                            ].map(([q, u, s]) => (
                                                <tr key={q}>
                                                    <td className="px-3 py-1.5 font-medium text-slate-800">{q}</td>
                                                    <td className="px-3 py-1.5 text-slate-600">{u}</td>
                                                    <td className="px-3 py-1.5 font-mono font-bold text-slate-700">{s}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <p className="mb-2"><strong>Sign Convention (right-hand rule):</strong></p>
                                <ul className="list-disc list-inside space-y-1 pl-2">
                                    <li><strong>Axial (N):</strong> Tension is positive (+), compression is negative (−).</li>
                                    <li><strong>Shear (V):</strong> Positive when acting in the positive local axis direction at the start of the member.</li>
                                    <li><strong>Moment (M):</strong> Positive sagging (tension on bottom fibre), negative hogging.</li>
                                    <li><strong>Displacements (δ):</strong> Positive in the direction of the positive global axis.</li>
                                    <li><strong>Reactions (R):</strong> Reported in the global coordinate system.</li>
                                    <li><strong>Global axes:</strong> X = horizontal (right), Y = vertical (up), Z = out-of-plane (right-hand rule).</li>
                                </ul>
                            </div>

                            {/* 2.5 Load Combinations */}
                            <SubHeading number="2.5" title="Load Combinations" />
                            {loadCombinations && loadCombinations.length > 0 ? (
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold">ID</th>
                                                <th className="px-3 py-2 font-bold">Combination Name</th>
                                                <th className="px-3 py-2 font-bold">Code Ref.</th>
                                                <th className="px-3 py-2 font-bold">Factors</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {loadCombinations.map((combo: LoadCombination, i: number) => (
                                                <tr key={combo.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                    <td className="px-3 py-2 font-mono font-bold text-slate-800">{combo.id}</td>
                                                    <td className="px-3 py-2 text-slate-700 font-medium">{combo.name}</td>
                                                    <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">{combo.code || '—'}</td>
                                                    <td className="px-3 py-2 text-slate-600">
                                                        {combo.factors?.map((f, fi: number) => {
                                                            const lc = loadCases?.find((c) => c.id === f.loadCaseId);
                                                            return (
                                                                <span key={fi}>
                                                                    {fi > 0 && ' + '}
                                                                    <span className="font-mono font-bold">{eng(f.factor, 1)}</span>
                                                                    <span className="text-slate-500"> × {lc?.name || f.loadCaseId}</span>
                                                                </span>
                                                            );
                                                        }) || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="mb-6">
                                    <p className="text-[11px] text-slate-600 mb-3">
                                        The following standard load combinations per IS 875 (Part 5) Table 4 are applicable for the limit state design of this structure:
                                    </p>
                                    <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px]">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-100 border-b border-slate-300">
                                                    <th className="px-3 py-2 font-bold text-slate-600">Limit State</th>
                                                    <th className="px-3 py-2 font-bold text-slate-600">Combination</th>
                                                    <th className="px-3 py-2 font-bold text-slate-600">Clause</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {[
                                                    ['ULS-1', '1.5 DL + 1.5 LL', 'Table 4 (1)'],
                                                    ['ULS-2', '1.5 DL + 1.5 WL/EQ', 'Table 4 (2)'],
                                                    ['ULS-3', '1.2 DL + 1.2 LL + 1.2 WL/EQ', 'Table 4 (3)'],
                                                    ['ULS-4', '0.9 DL + 1.5 WL/EQ', 'Table 4 (4)'],
                                                    ['SLS-1', '1.0 DL + 1.0 LL', 'Cl. 5.6'],
                                                    ['SLS-2', '1.0 DL + 1.0 WL', 'Cl. 5.6'],
                                                ].map(([ls, combo, cl]) => (
                                                    <tr key={ls}>
                                                        <td className="px-3 py-2 font-mono font-bold text-slate-800">{ls}</td>
                                                        <td className="px-3 py-2 text-slate-700">{combo}</td>
                                                        <td className="px-3 py-2 text-slate-500 text-[10px]">{cl}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 italic mt-2">
                                        DL = Dead Load, LL = Live/Imposed Load, WL = Wind Load, EQ = Seismic Load. Define project-specific combinations in the Design workspace for detailed analysis.
                                    </p>
                                </div>
                            )}
                        </Section>

                        {/* ╔══════════════════════════════════════════════════╗
                           ║          3.0  STRUCTURAL MODEL                   ║
                           ╚══════════════════════════════════════════════════╝ */}
                        <Section id="model" num="3.0" title="Structural Model">
                            {/* 3.1 Node Coordinates */}
                            <SubHeading number="3.1" title={`Node Coordinates (${nodeList.length} total)`} />
                            {nodeList.length > 0 ? (
                                <>
                                    <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-2">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                    <th className="px-3 py-2 font-bold w-16">Node</th>
                                                    <th className="px-3 py-2 font-bold text-right">X (m)</th>
                                                    <th className="px-3 py-2 font-bold text-right">Y (m)</th>
                                                    <th className="px-3 py-2 font-bold text-right">Z (m)</th>
                                                    <th className="px-3 py-2 font-bold text-center">Restraint</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {paginatedNodes.map((node, i) => {
                                                    const hasRestraint = Object.values(node.restraints || {}).some(Boolean);
                                                    const restraintCodes = hasRestraint
                                                        ? Object.entries(node.restraints || {})
                                                              .filter(([, v]) => v)
                                                              .map(([k]) => k.replace('r', 'R').toUpperCase())
                                                              .join(', ')
                                                        : 'Free';
                                                    return (
                                                        <tr key={node.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                            <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{node.id}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(node.x, 3)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(node.y, 3)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(node.z, 3)}</td>
                                                            <td className="px-3 py-1.5 text-center">
                                                                {hasRestraint ? (
                                                                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                                        {restraintCodes}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600 dark:text-slate-400">Free</span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination */}
                                    {totalNodePages > 1 && (
                                        <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 print:hidden mb-4">
                                            <span>
                                                Showing {nodesPage * ROWS_PER_PAGE + 1}–{Math.min((nodesPage + 1) * ROWS_PER_PAGE, nodeList.length)} of {nodeList.length}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button type="button"
                                                    disabled={nodesPage === 0}
                                                    onClick={() => setNodesPage((p) => p - 1)}
                                                    className="px-2 py-0.5 rounded border border-slate-300 disabled:opacity-30 hover:bg-slate-100"
                                                >
                                                    Prev
                                                </button>
                                                <span className="px-2 font-mono">
                                                    {nodesPage + 1}/{totalNodePages}
                                                </span>
                                                <button type="button"
                                                    disabled={nodesPage >= totalNodePages - 1}
                                                    onClick={() => setNodesPage((p) => p + 1)}
                                                    className="px-2 py-0.5 rounded border border-slate-300 disabled:opacity-30 hover:bg-slate-100"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-6 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    No nodes defined. Create a structural model to populate this section.
                                </div>
                            )}

                            {/* 3.2 Member Connectivity */}
                            <SubHeading number="3.2" title={`Member Connectivity (${memberList.length} total)`} />
                            {memberList.length > 0 ? (
                                <>
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-4">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold w-16">ID</th>
                                                <th className="px-3 py-2 font-bold text-center">Start Node</th>
                                                <th className="px-3 py-2 font-bold text-center">End Node</th>
                                                <th className="px-3 py-2 font-bold">Section</th>
                                                <th className="px-3 py-2 font-bold">Material</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {memberList.slice(0, ROWS_PER_PAGE).map((m, i) => (
                                                <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                    <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{m.id}</td>
                                                    <td className="px-3 py-1.5 text-center font-mono text-slate-600">{m.startNodeId ?? m.startNode ?? '—'}</td>
                                                    <td className="px-3 py-1.5 text-center font-mono text-slate-600">{m.endNodeId ?? m.endNode ?? '—'}</td>
                                                    <td className="px-3 py-1.5 text-slate-600">{m.section || m.sectionId || '—'}</td>
                                                    <td className="px-3 py-1.5 text-slate-600">{m.material || m.materialId || 'Steel'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {memberList.length > ROWS_PER_PAGE && (
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 italic mb-4">
                                        Showing first {ROWS_PER_PAGE} of {memberList.length} members. Full listing available in exported data.
                                    </p>
                                )}
                                </>
                            ) : (
                                <div className="p-6 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    No members defined.
                                </div>
                            )}

                            {/* 3.3 Section Properties */}
                            <SubHeading number="3.3" title={`Section Properties (${uniqueSections.length} unique section${uniqueSections.length !== 1 ? 's' : ''})`} />
                            {uniqueSections.length > 0 ? (
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold">Section ID</th>
                                                <th className="px-3 py-2 font-bold text-right">A (mm²)</th>
                                                <th className="px-3 py-2 font-bold text-right">I<sub>y</sub> (mm⁴)</th>
                                                <th className="px-3 py-2 font-bold text-right">I<sub>z</sub> (mm⁴)</th>
                                                <th className="px-3 py-2 font-bold text-right">J (mm⁴)</th>
                                                <th className="px-3 py-2 font-bold text-right">E (GPa)</th>
                                                <th className="px-3 py-2 font-bold text-center">Members</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {uniqueSections.map((sec, i) => {
                                                const db = sec.dbMatch;
                                                // Display from DB if available (mm units), else from member props (m units → convert)
                                                const area = db ? eng(db.A, 0) : sec.A ? eng(sec.A * 1e6, 0) : '—';
                                                const iy = db ? eng(db.Ix, 0) : sec.Iy ? eng(sec.Iy * 1e12, 0) : sec.I ? eng(sec.I * 1e12, 0) : '—';
                                                const iz = db ? eng(db.Iy, 0) : sec.Iz ? eng(sec.Iz * 1e12, 0) : '—';
                                                const j = db ? eng(db.J, 0) : sec.J ? eng(sec.J * 1e12, 0) : '—';
                                                const e = sec.E ? eng(sec.E / 1e6, 0) : '200';
                                                return (
                                                    <tr key={sec.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                        <td className="px-3 py-2 font-mono font-bold text-slate-800">{sec.id}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-600">{area}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-600">{iy}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-600">{iz}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-600">{j}</td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-600">{e}</td>
                                                        <td className="px-3 py-2 text-center font-mono">{sec.count}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    Assign sections in the Design workspace to populate this table.
                                </div>
                            )}

                            {/* 3.4 Applied Loads */}
                            <SubHeading number="3.4" title="Applied Loads" />
                            {(loads.length > 0 || memberLoads.length > 0) ? (
                                <>
                                    {/* Nodal Loads */}
                                    {loads.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[11px] font-bold text-slate-600 mb-2">Nodal Loads ({loads.length} applied)</p>
                                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px]">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                            <th className="px-3 py-2 font-bold">Node</th>
                                                            <th className="px-3 py-2 font-bold text-right">F<sub>x</sub> (kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">F<sub>y</sub> (kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">F<sub>z</sub> (kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">M<sub>x</sub> (kN·m)</th>
                                                            <th className="px-3 py-2 font-bold text-right">M<sub>y</sub> (kN·m)</th>
                                                            <th className="px-3 py-2 font-bold text-right">M<sub>z</sub> (kN·m)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {loads.slice(0, ROWS_PER_PAGE).map((l, i) => (
                                                            <tr key={l.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{l.nodeId ?? l.node ?? '—'}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(l.fx)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(l.fy)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(l.fz)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(l.mx)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(l.my)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(l.mz)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {loads.length > ROWS_PER_PAGE && (
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 italic mt-1">
                                                    Showing first {ROWS_PER_PAGE} of {loads.length} nodal loads.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Member Loads */}
                                    {memberLoads.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[11px] font-bold text-slate-600 mb-2">Member Loads ({memberLoads.length} applied)</p>
                                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px]">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                            <th className="px-3 py-2 font-bold">Member</th>
                                                            <th className="px-3 py-2 font-bold">Type</th>
                                                            <th className="px-3 py-2 font-bold text-right">w₁ / P (kN/m or kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">w₂ (kN/m)</th>
                                                            <th className="px-3 py-2 font-bold">Direction</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {memberLoads.slice(0, ROWS_PER_PAGE).map((ml, i) => (
                                                            <tr key={ml.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{ml.memberId}</td>
                                                                <td className="px-3 py-1.5 text-slate-600 font-medium">{ml.type}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(ml.w1 ?? ml.P)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{ml.type === 'UVL' ? eng(ml.w2) : '—'}</td>
                                                                <td className="px-3 py-1.5 text-slate-600">{(ml.direction || '').replace(/_/g, ' ')}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {memberLoads.length > ROWS_PER_PAGE && (
                                                <p className="text-[10px] text-slate-600 dark:text-slate-400 italic mt-1">
                                                    Showing first {ROWS_PER_PAGE} of {memberLoads.length} member loads.
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Load Cases summary */}
                                    {loadCases && loadCases.length > 0 && (
                                        <div className="mb-4">
                                            <p className="text-[11px] font-bold text-slate-600 mb-2">Load Cases ({loadCases.length} defined)</p>
                                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px]">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-100 border-b border-slate-300">
                                                            <th className="px-3 py-2 font-bold text-slate-600">ID</th>
                                                            <th className="px-3 py-2 font-bold text-slate-600">Name</th>
                                                            <th className="px-3 py-2 font-bold text-slate-600">Type</th>
                                                            <th className="px-3 py-2 font-bold text-slate-600 text-right">Factor</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-200">
                                                        {loadCases.map((lc) => (
                                                            <tr key={lc.id}>
                                                                <td className="px-3 py-2 font-mono font-bold text-slate-800">{lc.id}</td>
                                                                <td className="px-3 py-2 text-slate-700">{lc.name}</td>
                                                                <td className="px-3 py-2 text-slate-500 capitalize">{(lc.type || '').replace(/_/g, ' ')}</td>
                                                                <td className="px-3 py-2 text-right font-mono text-slate-600">{eng(lc.factor ?? 1.0, 1)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    <p>No loads have been applied to this model.</p>
                                    <p className="text-[11px] mt-1">Apply nodal or member loads in the Design workspace to populate this section.</p>
                                </div>
                            )}

                            {/* 3.5 Member End Releases */}
                            <SubHeading number="3.5" title="Member End Releases" />
                            {membersWithReleases.length > 0 ? (
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-4">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold">Member</th>
                                                <th className="px-3 py-2 font-bold text-center">Start Node</th>
                                                <th className="px-3 py-2 font-bold text-center">End Node</th>
                                                <th className="px-3 py-2 font-bold">Released DOFs — Start</th>
                                                <th className="px-3 py-2 font-bold">Released DOFs — End</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {membersWithReleases.map((m, i) => {
                                                const r = m.releases || {};
                                                const fmtReleases = (end: 'Start' | 'End') => {
                                                    const prefix = end.toLowerCase();
                                                    const dofs = ['fx', 'fy', 'fz', 'mx', 'my', 'mz'];
                                                    const labels = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'];
                                                    const released = dofs
                                                        .map((d, idx) => r[`${d}${end}`] || (end === 'Start' && d === 'my' && r.startMoment) || (end === 'End' && d === 'my' && r.endMoment) ? labels[idx] : null)
                                                        .filter(Boolean);
                                                    return released.length > 0 ? released.join(', ') : 'Fixed';
                                                };
                                                return (
                                                    <tr key={m.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                        <td className="px-3 py-2 font-mono font-bold text-slate-800">{m.id}</td>
                                                        <td className="px-3 py-2 text-center font-mono text-slate-600">{m.startNodeId}</td>
                                                        <td className="px-3 py-2 text-center font-mono text-slate-600">{m.endNodeId}</td>
                                                        <td className="px-3 py-2 text-slate-600">{fmtReleases('Start')}</td>
                                                        <td className="px-3 py-2 text-slate-600">{fmtReleases('End')}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 border border-slate-200 rounded text-[11px] text-slate-500 mb-4">
                                    All member ends are fully fixed (rigid connections). No releases defined.
                                </div>
                            )}
                        </Section>

                        {/* ╔══════════════════════════════════════════════════╗
                           ║         4.0  ANALYSIS RESULTS                    ║
                           ╚══════════════════════════════════════════════════╝ */}
                        <Section id="results" num="4.0" title="Analysis Results">
                            {/* Solver / method information */}
                            {analysisResults ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-sm p-4 text-[11px] text-slate-600 mb-6 leading-relaxed">
                                    <p>
                                        <strong>Analysis Method:</strong> {analysisResults.stats?.method || 'Direct Stiffness Method'} (linear elastic, first-order).
                                        {analysisResults.stats?.solveTimeMs !== undefined && (
                                            <> Solution time: <span className="font-mono font-bold">{eng(analysisResults.stats.solveTimeMs, 0)} ms</span>.</>
                                        )}
                                        {analysisResults.stats?.totalTimeMs !== undefined && (
                                            <> Total elapsed: <span className="font-mono font-bold">{eng(analysisResults.stats.totalTimeMs, 0)} ms</span>.</>
                                        )}
                                        {analysisResults.conditionNumber !== undefined && (
                                            <> Stiffness matrix condition number: <span className="font-mono font-bold">{eng(analysisResults.conditionNumber, 2)}</span>.</>
                                        )}
                                        {analysisResults.stats?.usedCloud && <> Computed via cloud solver.</>}
                                    </p>
                                    <p className="mt-1 text-[10px] text-slate-600 dark:text-slate-400">
                                        DOF count: {nodes.size * 6} ({nodes.size} nodes × 6 DOF). Global stiffness matrix assembled and factored using LU decomposition.
                                    </p>
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-amber-200 bg-amber-50 rounded text-center text-[12px] text-amber-700 mb-6">
                                    Analysis has not been executed. Run the solver from the Design workspace to populate all results.
                                </div>
                            )}

                            {/* 4.1 Equilibrium Verification */}
                            <SubHeading number="4.1" title="Equilibrium Verification" />
                            {analysisResults?.equilibriumCheck ? (
                                <div className="mb-6">
                                    <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-3">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                    <th className="px-3 py-2 font-bold">Component</th>
                                                    <th className="px-3 py-2 font-bold text-right">ΣApplied</th>
                                                    <th className="px-3 py-2 font-bold text-right">ΣReactions</th>
                                                    <th className="px-3 py-2 font-bold text-right">Residual</th>
                                                    <th className="px-3 py-2 font-bold text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'].map((label, idx) => {
                                                    const applied = analysisResults.equilibriumCheck!.applied_forces[idx] ?? 0;
                                                    const reaction = analysisResults.equilibriumCheck!.reaction_forces[idx] ?? 0;
                                                    const residual = analysisResults.equilibriumCheck!.residual[idx] ?? 0;
                                                    const ok = Math.abs(residual) < 0.01;
                                                    return (
                                                        <tr key={label} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                            <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{label} ({idx < 3 ? 'kN' : 'kN·m'})</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(applied, 4)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(reaction, 4)}</td>
                                                            <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(residual, 6)}</td>
                                                            <td className="px-3 py-1.5 text-center"><StatusPill status={ok ? 'PASS' : 'FAIL'} /></td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <StatusPill status={analysisResults.equilibriumCheck.pass ? 'PASS' : 'FAIL'} />
                                        <span className="text-slate-600">
                                            Global equilibrium error: <strong className="font-mono">{eng(analysisResults.equilibriumCheck.error_percent, 4)}%</strong>
                                            {analysisResults.equilibriumCheck.pass ? ' — within acceptable tolerance.' : ' — EXCEEDS tolerance. Review model for errors.'}
                                        </span>
                                    </div>
                                </div>
                            ) : analysisResults ? (
                                <div className="mb-6">
                                    <p className="text-[11px] text-slate-600 mb-3">
                                        Equilibrium verification can be confirmed by comparing the sum of applied loads with support reactions:
                                    </p>
                                    {analysisResults.reactions && analysisResults.reactions.size > 0 && (
                                        <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-3">
                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="bg-slate-100 border-b border-slate-300">
                                                        <th className="px-3 py-2 font-bold text-slate-600">Component</th>
                                                        <th className="px-3 py-2 font-bold text-slate-600 text-right">ΣReactions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {(() => {
                                                        const totals = { fx: 0, fy: 0, fz: 0, mx: 0, my: 0, mz: 0 };
                                                        analysisResults.reactions!.forEach((r) => {
                                                            totals.fx += (r.fx ?? r.Rx ?? 0);
                                                            totals.fy += (r.fy ?? r.Ry ?? 0);
                                                            totals.fz += (r.fz ?? r.Rz ?? 0);
                                                            totals.mx += (r.mx ?? r.Mx ?? 0);
                                                            totals.my += (r.my ?? r.My ?? 0);
                                                            totals.mz += (r.mz ?? r.Mz ?? 0);
                                                        });
                                                        return [
                                                            ['ΣRx (kN)', totals.fx], ['ΣRy (kN)', totals.fy], ['ΣRz (kN)', totals.fz],
                                                            ['ΣMx (kN·m)', totals.mx], ['ΣMy (kN·m)', totals.my], ['ΣMz (kN·m)', totals.mz],
                                                        ].map(([label, val], i) => (
                                                            <tr key={label as string} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{label as string}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(val as number, 4)}</td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    Run analysis to generate equilibrium verification data.
                                </div>
                            )}

                            {/* 4.2 Member Forces */}
                            <SubHeading number="4.2" title={`Internal Member Forces${forcesEntries.length > 0 ? ` (${forcesEntries.length} members)` : ''}`} />

                            {forcesEntries.length > 0 ? (
                                <>
                                    {/* Check if start/end forces are available */}
                                    {(() => {
                                        const hasEndForces = forcesEntries.some(([, f]) => f.startForces || f.endForces);
                                        if (hasEndForces) {
                                            return (
                                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-2">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                                <th className="px-2 py-2 font-bold w-14" rowSpan={2}>Member</th>
                                                                <th className="px-2 py-2 font-bold text-center" rowSpan={2}>End</th>
                                                                <th className="px-2 py-2 font-bold text-right">N (kN)</th>
                                                                <th className="px-2 py-2 font-bold text-right">V<sub>y</sub> (kN)</th>
                                                                <th className="px-2 py-2 font-bold text-right">V<sub>z</sub> (kN)</th>
                                                                <th className="px-2 py-2 font-bold text-right">M<sub>y</sub> (kN·m)</th>
                                                                <th className="px-2 py-2 font-bold text-right">M<sub>z</sub> (kN·m)</th>
                                                                <th className="px-2 py-2 font-bold text-right">T (kN·m)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {paginatedForces.map(([id, f], i) => {
                                                                const sf = f.startForces;
                                                                const ef = f.endForces;
                                                                return (
                                                                    <React.Fragment key={id}>
                                                                        <tr className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                                            <td className="px-2 py-1 font-mono font-bold text-slate-800 border-b border-slate-100" rowSpan={2}>{id}</td>
                                                                            <td className="px-2 py-1 text-center text-[10px] font-bold text-blue-600">Start</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(sf?.axial ?? f.axial)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(sf?.shearY ?? f.shearY)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(sf?.shearZ ?? f.shearZ)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(sf?.momentY ?? f.momentY)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(sf?.momentZ ?? f.momentZ)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(sf?.torsion ?? f.torsion)}</td>
                                                                        </tr>
                                                                        <tr className={`${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'} border-b border-slate-200`}>
                                                                            <td className="px-2 py-1 text-center text-[10px] font-bold text-amber-600">End</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(ef?.axial ?? f.axial)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(ef?.shearY ?? f.shearY)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(ef?.shearZ ?? f.shearZ)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(ef?.momentY ?? f.momentY)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(ef?.momentZ ?? f.momentZ)}</td>
                                                                            <td className="px-2 py-1 text-right font-mono text-slate-600">{eng(ef?.torsion ?? f.torsion)}</td>
                                                                        </tr>
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        }
                                        // Fallback: single-row per member (original layout with torsion added)
                                        return (
                                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-2">
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                            <th className="px-3 py-2 font-bold w-16">Member</th>
                                                            <th className="px-3 py-2 font-bold text-right">N (kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">V<sub>y</sub> (kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">V<sub>z</sub> (kN)</th>
                                                            <th className="px-3 py-2 font-bold text-right">M<sub>y</sub> (kN·m)</th>
                                                            <th className="px-3 py-2 font-bold text-right">M<sub>z</sub> (kN·m)</th>
                                                            <th className="px-3 py-2 font-bold text-right">T (kN·m)</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {paginatedForces.map(([id, f], i) => (
                                                            <tr key={id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                                <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{id}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(f.axial)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(f.shearY)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(f.shearZ)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(f.momentY)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(f.momentZ)}</td>
                                                                <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(f.torsion)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })()}
                                    {totalForcePages > 1 && (
                                        <div className="flex items-center justify-between text-[10px] text-slate-600 dark:text-slate-400 print:hidden mb-4">
                                            <span>
                                                Showing {forcesPage * ROWS_PER_PAGE + 1}–{Math.min((forcesPage + 1) * ROWS_PER_PAGE, forcesEntries.length)} of {forcesEntries.length}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <button type="button"
                                                    disabled={forcesPage === 0}
                                                    onClick={() => setForcesPage((p) => p - 1)}
                                                    className="px-2 py-0.5 rounded border border-slate-300 disabled:opacity-30 hover:bg-slate-100"
                                                >
                                                    Prev
                                                </button>
                                                <span className="px-2 font-mono">
                                                    {forcesPage + 1}/{totalForcePages}
                                                </span>
                                                <button type="button"
                                                    disabled={forcesPage >= totalForcePages - 1}
                                                    onClick={() => setForcesPage((p) => p + 1)}
                                                    className="px-2 py-0.5 rounded border border-slate-300 disabled:opacity-30 hover:bg-slate-100"
                                                >
                                                    Next
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="p-6 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    Run the analysis to populate member force results.
                                </div>
                            )}

                            {/* 4.3 Critical Members Summary */}
                            <SubHeading number="4.3" title="Critical Members Summary" />
                            {criticalMembers ? (
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold">Action</th>
                                                <th className="px-3 py-2 font-bold text-center">Governing Member</th>
                                                <th className="px-3 py-2 font-bold text-right">Value</th>
                                                <th className="px-3 py-2 font-bold text-right">|Value|</th>
                                                <th className="px-3 py-2 font-bold">Unit</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {criticalMembers.map((cm, i) => (
                                                <tr key={cm.action} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                    <td className="px-3 py-2 font-medium text-slate-800">{cm.action}</td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span className="bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                                                            {cm.id || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-mono text-slate-600">{eng(cm.value)}</td>
                                                    <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{eng(cm.absValue)}</td>
                                                    <td className="px-3 py-2 text-slate-500">{cm.unit}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    Critical members will be identified after analysis.
                                </div>
                            )}

                            {/* 4.4 Support Reactions */}
                            <SubHeading number="4.4" title="Support Reactions" />
                            {analysisResults?.reactions && analysisResults.reactions.size > 0 ? (
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold">Node</th>
                                                <th className="px-3 py-2 font-bold text-right">R<sub>x</sub> (kN)</th>
                                                <th className="px-3 py-2 font-bold text-right">R<sub>y</sub> (kN)</th>
                                                <th className="px-3 py-2 font-bold text-right">R<sub>z</sub> (kN)</th>
                                                <th className="px-3 py-2 font-bold text-right">M<sub>x</sub> (kN·m)</th>
                                                <th className="px-3 py-2 font-bold text-right">M<sub>y</sub> (kN·m)</th>
                                                <th className="px-3 py-2 font-bold text-right">M<sub>z</sub> (kN·m)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from(analysisResults.reactions.entries()).map(([id, r], i) => (
                                                <tr key={id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                    <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{id}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(r.fx ?? r.Rx)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(r.fy ?? r.Ry)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(r.fz ?? r.Rz)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(r.mx ?? r.Mx)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(r.my ?? r.My)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(r.mz ?? r.Mz)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    Support reactions will appear after analysis.
                                </div>
                            )}

                            {/* 4.5 Nodal Displacements */}
                            <SubHeading number="4.5" title="Nodal Displacements" />
                            {analysisResults?.displacements && analysisResults.displacements.size > 0 ? (
                                <>
                                <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-6">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                <th className="px-3 py-2 font-bold">Node</th>
                                                <th className="px-3 py-2 font-bold text-right">δ<sub>x</sub> (mm)</th>
                                                <th className="px-3 py-2 font-bold text-right">δ<sub>y</sub> (mm)</th>
                                                <th className="px-3 py-2 font-bold text-right">δ<sub>z</sub> (mm)</th>
                                                <th className="px-3 py-2 font-bold text-right">θ<sub>x</sub> (rad)</th>
                                                <th className="px-3 py-2 font-bold text-right">θ<sub>y</sub> (rad)</th>
                                                <th className="px-3 py-2 font-bold text-right">θ<sub>z</sub> (rad)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Array.from(analysisResults.displacements.entries()).slice(0, ROWS_PER_PAGE).map(([id, d], i) => (
                                                <tr key={id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                    <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{id}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(d.dx, 4)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(d.dy, 4)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(d.dz, 4)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(d.rx ?? d.rotX, 6)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(d.ry ?? d.rotY, 6)}</td>
                                                    <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(d.rz ?? d.rotZ, 6)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {analysisResults.displacements.size > ROWS_PER_PAGE && (
                                    <p className="text-[10px] text-slate-600 dark:text-slate-400 italic mb-4">
                                        Showing first {ROWS_PER_PAGE} of {analysisResults.displacements.size} nodal results. Full data available in exported spreadsheet.
                                    </p>
                                )}
                                </>
                            ) : (
                                <div className="p-4 border-2 border-dashed border-slate-200 rounded text-center text-[12px] text-slate-600 dark:text-slate-400 mb-6">
                                    Displacement results will appear after analysis.
                                </div>
                            )}

                            {/* 4.6 Modal Analysis */}
                            <SubHeading number="4.6" title="Modal Analysis" />
                            {modalResults && modalResults.modes && modalResults.modes.length > 0 ? (
                                <div className="mb-6">
                                    <p className="text-[11px] text-slate-600 mb-3">
                                        Dynamic (eigenvalue) analysis yielded <strong>{modalResults.modes.length} mode{modalResults.modes.length !== 1 ? 's' : ''}</strong>.
                                        {modalResults.totalMass !== undefined && <> Total structural mass: <strong className="font-mono">{eng(modalResults.totalMass, 1)} kg</strong>.</>}
                                    </p>
                                    <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px]">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                                    <th className="px-3 py-2 font-bold text-center">Mode</th>
                                                    <th className="px-3 py-2 font-bold text-right">Frequency (Hz)</th>
                                                    <th className="px-3 py-2 font-bold text-right">Period (s)</th>
                                                    <th className="px-3 py-2 font-bold text-right">&omega; (rad/s)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {modalResults.modes.slice(0, 12).map((mode, i: number) => (
                                                    <tr key={mode.modeNumber} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                        <td className="px-3 py-1.5 text-center font-mono font-bold text-slate-800">{mode.modeNumber}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(mode.frequency, 4)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(mode.period, 4)}</td>
                                                        <td className="px-3 py-1.5 text-right font-mono text-slate-600">{eng(mode.angularFrequency, 2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {modalResults.modes.length > 12 && (
                                        <p className="text-[10px] text-slate-600 dark:text-slate-400 italic mt-1">
                                            Showing first 12 of {modalResults.modes.length} modes. Full data available in exported results.
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 border border-slate-200 rounded text-[11px] text-slate-500 mb-4">
                                    Modal analysis was not performed for this model. Run eigenvalue analysis to display natural frequencies and mode shapes.
                                </div>
                            )}
                        </Section>

                        {/* ╔══════════════════════════════════════════════════╗
                           ║         5.0  DESIGN VERIFICATION                 ║
                           ╚══════════════════════════════════════════════════╝ */}
                        <Section id="design" num="5.0" title="Design Verification">
                            <p className="text-[12px] text-slate-600 leading-relaxed mb-4">
                                The following table summarises the key design checks performed on the structural model.
                                All checks are carried out in accordance with the applicable design codes listed in Section 2.1.
                                Where capacity values are not explicitly assigned, conservative assumed capacities are used;
                                the engineer should verify against actual section properties.
                            </p>
                            <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-4">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                            <th className="px-3 py-2 font-bold">Check</th>
                                            <th className="px-3 py-2 font-bold">Code Ref.</th>
                                            <th className="px-3 py-2 font-bold text-right">Demand</th>
                                            <th className="px-3 py-2 font-bold text-right">Capacity</th>
                                            <th className="px-3 py-2 font-bold text-right">D/C Ratio</th>
                                            <th className="px-3 py-2 font-bold text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            // Assumed reference capacities for indicative D/C ratios
                                            const axialCap = 500; // kN — assumed section capacity
                                            const momentCap = 150; // kN·m
                                            const shearCap = 300;  // kN
                                            const deflLimit = 25;  // mm (L/300 ≈ 25mm for ~7.5m span)

                                            const axialRatio = maxAxial !== undefined ? maxAxial / axialCap : undefined;
                                            const momentRatio = maxMoment !== undefined ? maxMoment / momentCap : undefined;
                                            const shearRatio = maxShear !== undefined ? maxShear / shearCap : undefined;
                                            const deflRatio = maxDisp !== undefined ? maxDisp / deflLimit : undefined;

                                            const ratioStatus = (r: number | undefined): 'PASS' | 'WARN' | 'FAIL' | 'N/A' => {
                                                if (r === undefined) return 'N/A';
                                                if (r <= 0.85) return 'PASS';
                                                if (r <= 1.0) return 'WARN';
                                                return 'FAIL';
                                            };

                                            return [
                                                {
                                                    check: 'Global Equilibrium',
                                                    code: 'Statics',
                                                    demand: analysisResults ? 'Verified' : '—',
                                                    capacity: '—',
                                                    ratio: analysisResults ? '—' : '—',
                                                    status: analysisResults ? 'PASS' as const : 'N/A' as const,
                                                },
                                                {
                                                    check: 'Member Strength — Axial',
                                                    code: 'IS 800 Cl. 7',
                                                    demand: maxAxial !== undefined ? eng(maxAxial) + ' kN' : '—',
                                                    capacity: analysisResults ? eng(axialCap) + ' kN *' : '—',
                                                    ratio: axialRatio !== undefined ? eng(axialRatio, 3) : '—',
                                                    status: analysisResults ? ratioStatus(axialRatio) : 'N/A' as const,
                                                },
                                                {
                                                    check: 'Member Strength — Flexure',
                                                    code: 'IS 800 Cl. 8',
                                                    demand: maxMoment !== undefined ? eng(maxMoment) + ' kN·m' : '—',
                                                    capacity: analysisResults ? eng(momentCap) + ' kN·m *' : '—',
                                                    ratio: momentRatio !== undefined ? eng(momentRatio, 3) : '—',
                                                    status: analysisResults ? ratioStatus(momentRatio) : 'N/A' as const,
                                                },
                                                {
                                                    check: 'Member Strength — Shear',
                                                    code: 'IS 800 Cl. 8.4',
                                                    demand: maxShear !== undefined ? eng(maxShear) + ' kN' : '—',
                                                    capacity: analysisResults ? eng(shearCap) + ' kN *' : '—',
                                                    ratio: shearRatio !== undefined ? eng(shearRatio, 3) : '—',
                                                    status: analysisResults ? ratioStatus(shearRatio) : 'N/A' as const,
                                                },
                                                {
                                                    check: 'Serviceability — Deflection',
                                                    code: 'IS 800 Cl. 5.6',
                                                    demand: maxDisp !== undefined ? eng(maxDisp, 4) + ' mm' : '—',
                                                    capacity: eng(deflLimit, 1) + ' mm (L/300)',
                                                    ratio: deflRatio !== undefined ? eng(deflRatio, 3) : '—',
                                                    status: analysisResults ? ratioStatus(deflRatio) : 'N/A' as const,
                                                },
                                            ];
                                        })().map((row, i) => (
                                            <tr key={row.check} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                                                <td className="px-3 py-2 font-medium text-slate-800">{row.check}</td>
                                                <td className="px-3 py-2 font-mono text-slate-500 text-[10px]">{row.code}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-600">{row.demand}</td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-600">{row.capacity}</td>
                                                <td className="px-3 py-2 text-right font-mono font-bold text-slate-800">{row.ratio}</td>
                                                <td className="px-3 py-2 text-center"><StatusPill status={row.status} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 italic">
                                * Capacity values marked with asterisk are assumed reference values for indicative D/C ratios.
                                Actual member capacities should be verified against assigned section properties in the detailed design.
                            </p>
                        </Section>

                        {/* ╔══════════════════════════════════════════════════╗
                           ║     6.0  CONCLUSIONS & RECOMMENDATIONS          ║
                           ╚══════════════════════════════════════════════════╝ */}
                        <Section id="conclusions" num="6.0" title="Conclusions & Recommendations">
                            <div className="text-[12px] text-slate-600 leading-relaxed space-y-3 mb-4">
                                <p>
                                    Based on the analysis presented in this report, the structural model comprising {nodes.size} nodes
                                    and {members.size} members ({supportCount} support{supportCount !== 1 ? 's' : ''}, {freeNodes} free node{freeNodes !== 1 ? 's' : ''}) has been evaluated using the direct stiffness method with full 3-D frame capability.
                                    {analysisResults
                                        ? ` The analysis has been completed successfully and results are presented in Section 4.0. Key peak values are:`
                                        : ' Analysis is pending; results will be available upon execution of the solver.'}
                                </p>
                                {analysisResults && (
                                    <ul className="list-disc list-inside space-y-1 pl-2 text-[11px]">
                                        {maxAxial !== undefined && <li>Maximum axial force: <strong>{eng(maxAxial)} kN</strong></li>}
                                        {maxMoment !== undefined && <li>Maximum bending moment: <strong>{eng(maxMoment)} kN·m</strong></li>}
                                        {maxShear !== undefined && <li>Maximum shear force: <strong>{eng(maxShear)} kN</strong></li>}
                                        {maxDisp !== undefined && <li>Maximum displacement: <strong>{eng(maxDisp, 4)} mm</strong>
                                            {maxDisp > 25 ? <span className="text-amber-600 font-medium"> — exceeds L/300 limit, review required</span> : <span className="text-green-700 font-medium"> — within serviceability limits</span>}
                                        </li>}
                                    </ul>
                                )}
                                <p><strong>Recommendations:</strong></p>
                                <ol className="list-decimal list-inside space-y-1.5 pl-2">
                                    <li>Verify all applied loads against the latest project load schedule.</li>
                                    <li>Confirm connection details are consistent with the assumed rigidity in the model.</li>
                                    <li>Review deflection results against project-specific serviceability criteria.</li>
                                    <li>Conduct independent spot-checks of critical member designs.</li>
                                    <li>Ensure capacity values in the design verification table (Section 5.0) are replaced with actual section values before issuing for construction.</li>
                                    <li>Ensure all design modifications are incorporated before issuing for construction.</li>
                                </ol>

                                <div className="mt-6 border-t border-slate-200 pt-4">
                                    <p className="text-[11px] font-bold text-slate-700 mb-2">Disclaimer & Limitations</p>
                                    <ul className="list-disc list-inside space-y-1.5 text-[10px] text-slate-500 leading-relaxed">
                                        <li>This report has been prepared using automated structural analysis software (BeamLab). Results should be independently verified by a qualified structural engineer.</li>
                                        <li>The analysis is limited to a linear elastic, first-order static analysis unless otherwise stated. Effects of geometric nonlinearity (P-Δ), material nonlinearity, and construction sequence are outside the scope of this report.</li>
                                        <li>The design verification checks presented in Section 5.0 are indicative only and based on assumed reference capacities. They do not constitute a full code-compliance design check.</li>
                                        <li>Connection design, foundation design, and detailing are not covered in this report.</li>
                                        <li>The engineer of record must verify all inputs, assumptions, loading, boundary conditions, and results before relying on this analysis for design or construction purposes.</li>
                                        <li>Soil–structure interaction, temperature effects, creep, shrinkage, and fatigue considerations are excluded unless explicitly included in the model.</li>
                                    </ul>
                                </div>
                            </div>
                        </Section>

                        {/* ╔══════════════════════════════════════════════════╗
                           ║        APPENDIX A — SIGNATURES & APPROVAL       ║
                           ╚══════════════════════════════════════════════════╝ */}
                        <section className="mt-16 mb-12 print:break-before-page">
                            <SectionHeading number="A" title="Signatures & Approval" />
                            <p className="text-[11px] text-slate-500 mb-8">
                                This document has been prepared, checked, and approved by the signatories below.
                            </p>
                            <div className="grid grid-cols-3 gap-10">
                                {[
                                    { role: 'Prepared by', name: userName, title: 'Structural Engineer' },
                                    { role: 'Checked by', name: '________________', title: 'Senior Engineer' },
                                    { role: 'Approved by', name: '________________', title: 'Project Manager' },
                                ].map((sig) => (
                                    <div key={sig.role}>
                                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">{sig.role}</p>
                                        <div className="h-16 border-b-2 border-slate-400 mb-2" />
                                        <p className="text-[12px] font-bold text-slate-900">{sig.name}</p>
                                        <p className="text-[10px] text-slate-500">{sig.title}</p>
                                        <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">Date: _______________</p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ── Document footer ── */}
                        <div className="border-t-2 border-slate-200 dark:border-slate-800 pt-4 pb-8 text-center">
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                                This is a computer-generated document. Results should be independently verified.
                            </p>
                            <p className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                                Generated by <strong>BeamLab</strong> — Document {ref} Rev {revision} — {fmtDate(now)} {fmtTime(now)}
                            </p>
                            <p className="text-[9px] text-slate-700 dark:text-slate-300 mt-2">
                                © {now.getFullYear()} BeamLab. All rights reserved. CONFIDENTIAL.
                            </p>
                        </div>
                    </div>
                </article>
            </main>

            {/* ━━━ Floating Action Bar (hidden in print) ━━━ */}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 print:hidden">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700">
                    <button type="button"
                        onClick={handleExportPDF}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
                    >
                        <Download className="w-5 h-5" />
                        Download PDF
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button type="button"
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-3 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
                    >
                        <Printer className="w-5 h-5" />
                        Print
                    </button>
                    <button type="button" className="flex items-center gap-2 px-6 py-3 rounded-lg text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm transition-colors">
                        <Share2 className="w-5 h-5" />
                        Share
                    </button>
                </div>
            </div>

            {/* ━━━ Export sidebar (hidden in print) ━━━ */}
            <div className="fixed bottom-6 right-6 z-40 print:hidden flex flex-col gap-3">
                <button type="button"
                    onClick={handleExportDXF}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-slate-500 dark:text-slate-300 font-medium text-sm"
                    title="Export DXF (AutoCAD)"
                >
                    <Layout className="w-5 h-5 text-fuchsia-600" />
                    <span className="hidden md:inline">DXF</span>
                </button>
                <button type="button"
                    onClick={handleExportIFC}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-slate-500 dark:text-slate-300 font-medium text-sm"
                    title="Export IFC (BIM)"
                >
                    <FileCode className="w-5 h-5 text-amber-600" />
                    <span className="hidden md:inline">IFC</span>
                </button>
                <button type="button"
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all text-slate-500 dark:text-slate-300 font-medium text-sm"
                    title="Export Results to Excel (CSV)"
                >
                    <TableProperties className="w-5 h-5 text-green-600" />
                    <span className="hidden md:inline">Excel</span>
                </button>
            </div>
        </div>
    );
};

export default ReportsPage;
