/**
 * UnifiedReportTemplate.tsx
 *
 * React component library for building consistent BeamLab engineering reports.
 * All reports across the application (analysis, design, connection, export)
 * use these primitives so every output has the same professional appearance:
 *
 *   • Navy (#12376A) + gold (#BF9B30) accent bars on cover and headers
 *   • Consistent typography (Inter / system)
 *   • Branded cover page with document control table
 *   • Collapsible section headings with auto-numbering
 *   • KPI traffic-light cards
 *   • PASS / FAIL / WARN status pills
 *   • Alternating-row engineering tables
 *   • Running header + print @page CSS injection
 *   • Logo on every page
 *
 * Usage:
 *   <ReportDocument meta={...} branding={DEFAULT_BRANDING}>
 *     <ReportCoverPage meta={...} branding={...} />
 *     <ReportRunningHeader meta={...} />
 *     <ReportSection num="1" title="Executive Summary">
 *       <ReportKpiGrid kpis={[...]} />
 *     </ReportSection>
 *   </ReportDocument>
 */

import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Logo } from '../branding/Logo';
import type { BrandingConfig, ReportMetadata, KpiCardData, StatusPillValue } from '../../types/ReportTypes';
import { DEFAULT_BRANDING } from '../../services/ReportTemplateService';
import { BEAMLAB_COLORS } from '../../constants/BrandingConstants';

// ─── ReportDocument ─────────────────────────────────────────────────────────

interface ReportDocumentProps {
  meta: ReportMetadata;
  branding?: BrandingConfig;
  children: React.ReactNode;
  /** Whether to show the DRAFT diagonal watermark (when no analysis results) */
  showDraftWatermark?: boolean;
}

/**
 * Outer A4 document wrapper with shadow, max-width, print reset,
 * and injected @page CSS for running header/footer.
 */
export const ReportDocument: React.FC<ReportDocumentProps> = ({
  meta,
  branding = DEFAULT_BRANDING,
  children,
  showDraftWatermark = false,
}) => (
  <div
    className="relative w-full max-w-[210mm] bg-white text-slate-900 shadow-2xl rounded-sm mb-24
      print:mb-0 print:shadow-none print:w-full print:max-w-none print:rounded-none"
    style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}
  >
    {/* @page print CSS */}
    <style>{`
      @media print {
        @page {
          size: A4 portrait;
          margin: 20mm 15mm 25mm 15mm;
          @top-left   { content: "${branding.companyName} — ${meta.docRef}"; font-size: 8pt; color: #94a3b8; }
          @top-right  { content: "Rev ${meta.revision}  |  ${meta.date}"; font-size: 8pt; color: #94a3b8; }
          @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #94a3b8; }
          @bottom-left { content: "${branding.disclaimer}"; font-size: 7pt; color: #cbd5e1; }
        }
      }
    `}</style>

    {/* DRAFT watermark */}
    {showDraftWatermark && (
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none print:hidden z-0">
        <span
          className="absolute top-1/2 left-1/2 text-[120px] font-black text-slate-200 tracking-[0.3em] whitespace-nowrap"
          style={{ transform: 'translate(-50%,-50%) rotate(-35deg)' }}
        >
          DRAFT
        </span>
      </div>
    )}

    <div className="relative z-10">{children}</div>
  </div>
);

// ─── ReportCoverPage ─────────────────────────────────────────────────────────

interface ReportCoverPageProps {
  meta: ReportMetadata;
  branding?: BrandingConfig;
}

/**
 * Full A4 cover page — navy accent bar, gold stripe, centred title block,
 * document control table. Matches ReportsPage.tsx cover exactly.
 */
export const ReportCoverPage: React.FC<ReportCoverPageProps> = ({
  meta,
  branding = DEFAULT_BRANDING,
}) => {
  const statusColor =
    meta.status === 'Draft' ? 'text-amber-600' :
    meta.status === 'Issued for Construction' ? 'text-green-700' :
    meta.status === 'Superseded' ? 'text-slate-500' :
    'text-blue-600';

  return (
    <div className="relative min-h-[297mm] flex flex-col justify-between p-12 md:p-16 print:p-[25mm] print:break-after-page">
      {/* Navy accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[6px]" style={{ background: branding.primaryColor }} />
      {/* Gold stripe */}
      <div className="absolute top-[6px] left-0 right-0 h-[3px]" style={{ background: branding.accentColor }} />

      {/* Header — logo + company name + contact */}
      <div className="flex items-start justify-between mt-2">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 flex items-center justify-center">
            <Logo size="lg" variant="icon" clickable={false} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">
              {branding.companyName}
            </h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.25em] mt-0.5">
              {branding.tagline}
            </p>
          </div>
        </div>
        <div className="text-right text-[10px] text-slate-500 space-y-0.5 leading-tight">
          <p>{branding.website}</p>
          <p>{branding.email}</p>
        </div>
      </div>

      {/* Centre title block */}
      <div className="flex-1 flex flex-col items-center justify-center text-center -mt-12">
        <div className="w-24 h-0.5 bg-slate-300 mb-8" />
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-3">
          {meta.reportType}
        </p>
        <h2
          className="text-3xl md:text-4xl font-black leading-tight mb-4 max-w-md"
          style={{ color: branding.primaryColor }}
        >
          {meta.projectName}
        </h2>
        {meta.projectNumber && (
          <p className="text-sm text-slate-500 mb-1">Project No: {meta.projectNumber}</p>
        )}
        <p className="text-sm text-slate-500 font-medium tracking-wide mb-1">
          Document Ref: <span className="font-mono">{meta.docRef}</span>
        </p>
        <p className="text-sm text-slate-500">
          Revision {meta.revision} &mdash; {meta.date}
        </p>
        {meta.client && (
          <p className="text-sm text-slate-500 mt-3">Client: {meta.client}</p>
        )}
        {meta.location && (
          <p className="text-sm text-slate-500">Location: {meta.location}</p>
        )}
        <div className="w-24 h-0.5 bg-slate-300 mt-8" />
      </div>

      {/* Document control table */}
      <div className="border border-slate-300 rounded text-[11px] overflow-hidden">
        <table className="w-full text-left">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50 w-1/4">Project</td>
              <td className="px-3 py-2 text-slate-900">{meta.projectName}</td>
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50 w-1/4">Document No.</td>
              <td className="px-3 py-2 text-slate-900 font-mono">{meta.docRef}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Prepared by</td>
              <td className="px-3 py-2 text-slate-900">{meta.preparedBy}</td>
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Date</td>
              <td className="px-3 py-2 text-slate-900">{meta.date}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Status</td>
              <td className={`px-3 py-2 font-bold ${statusColor}`}>{meta.status}</td>
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Revision</td>
              <td className="px-3 py-2 text-slate-900 font-mono">{meta.revision}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── ReportRunningHeader ──────────────────────────────────────────────────────

interface ReportRunningHeaderProps {
  meta: ReportMetadata;
  branding?: BrandingConfig;
}

/**
 * On-screen running header bar shown between cover and body sections.
 * Hidden in print (CSS @page handles that).
 */
export const ReportRunningHeader: React.FC<ReportRunningHeaderProps> = ({
  meta,
  branding = DEFAULT_BRANDING,
}) => (
  <div
    className="flex items-center justify-between px-12 md:px-16 print:hidden py-2 bg-slate-50
      text-[10px] text-slate-600 border-b-2"
    style={{ borderColor: branding.primaryColor }}
  >
    <span className="font-bold tracking-wider">
      {branding.companyName} &mdash; {meta.docRef}
    </span>
    <span>Rev {meta.revision}&nbsp;|&nbsp;{meta.date}</span>
  </div>
);

// ─── ReportSection ────────────────────────────────────────────────────────────

interface ReportSectionProps {
  id: string;
  num: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

/**
 * Collapsible section wrapper — always open in print, toggleable on screen.
 * Matches ReportsPage.tsx Section component behaviour.
 */
export const ReportSection: React.FC<ReportSectionProps> = ({
  id: _id,
  num,
  title,
  children,
  defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="print:break-inside-avoid-page">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between border-b-2 border-slate-200
          pb-1.5 mb-5 mt-10 print:pointer-events-none"
      >
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-black text-slate-500 tracking-wider">{num}</span>
          <h2 className="text-[15px] font-extrabold uppercase tracking-wide text-slate-900">{title}</h2>
        </div>
        <span className="print:hidden text-slate-500">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      <div className={`${open ? '' : 'hidden'} print:!block`}>{children}</div>
    </section>
  );
};

// ─── ReportSubHeading ─────────────────────────────────────────────────────────

export const ReportSubHeading: React.FC<{ num: string; title: string }> = ({ num, title }) => (
  <div className="flex items-baseline gap-2 border-b border-slate-300 pb-1 mb-3 mt-6">
    <span className="text-xs font-bold text-slate-500">{num}</span>
    <h3 className="text-[13px] font-bold text-slate-700">{title}</h3>
  </div>
);

// ─── ReportKpiCard ────────────────────────────────────────────────────────────

const KPI_BORDER: Record<string, string> = {
  pass: 'border-l-green-500',
  warn: 'border-l-amber-500',
  fail: 'border-l-red-500',
  info: 'border-l-blue-500',
};

export const ReportKpiCard: React.FC<KpiCardData> = ({ label, value, unit, status }) => (
  <div className={`border border-slate-200 border-l-4 ${KPI_BORDER[status ?? 'info']} rounded-sm px-4 py-3 print:bg-white`}>
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-lg font-black text-slate-900 leading-tight">
      {value}
      {unit && <span className="text-xs font-medium tracking-wide text-slate-500 ml-1">{unit}</span>}
    </p>
  </div>
);

/** Grid of KPI cards — pass an array of KpiCardData */
export const ReportKpiGrid: React.FC<{ kpis: KpiCardData[] }> = ({ kpis }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
    {kpis.map((k, i) => <ReportKpiCard key={i} {...k} />)}
  </div>
);

// ─── ReportStatusPill ─────────────────────────────────────────────────────────

const PILL_STYLE: Record<StatusPillValue, string> = {
  PASS: 'bg-green-100 text-green-800 border-green-300',
  FAIL: 'bg-red-100 text-red-800 border-red-300',
  WARN: 'bg-amber-100 text-amber-800 border-amber-300',
  'N/A': 'bg-slate-100 text-slate-500 border-slate-300',
};

export const ReportStatusPill: React.FC<{ status: StatusPillValue }> = ({ status }) => (
  <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${PILL_STYLE[status]}`}>
    {status === 'PASS' && <CheckCircle2 className="w-3 h-3" />}
    {status === 'FAIL' && <XCircle className="w-3 h-3" />}
    {status === 'WARN' && <AlertTriangle className="w-3 h-3" />}
    {status}
  </span>
);

// ─── ReportTable ──────────────────────────────────────────────────────────────

interface ReportTableProps {
  headers: string[];
  rows: (string | number | React.ReactNode)[][];
  /** Column index from which numeric right-alignment begins */
  rightAlignFrom?: number;
  caption?: string;
}

/**
 * Professional engineering table with alternating rows and sticky header.
 * Mirrors the styling used in ReportsPage.tsx for analysis result tables.
 */
export const ReportTable: React.FC<ReportTableProps> = ({
  headers,
  rows,
  rightAlignFrom = 1,
  caption,
}) => (
  <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-5">
    {caption && (
      <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
        {caption}
      </div>
    )}
    <table className="w-full text-left">
      <thead>
        <tr className="bg-slate-100 text-slate-700">
          {headers.map((h, i) => (
            <th key={i} className={`px-3 py-2 font-bold ${i >= rightAlignFrom ? 'text-right' : ''}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className={`border-t border-slate-200 ${ri % 2 === 1 ? 'bg-slate-50' : ''}`}>
            {row.map((cell, ci) => (
              <td key={ci} className={`px-3 py-1.5 ${ci >= rightAlignFrom ? 'text-right font-mono' : ''}`}>
                {cell === undefined || cell === null ? '—' : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── ReportDocumentControl ────────────────────────────────────────────────────

interface RevisionRow {
  rev: string;
  date: string;
  description: string;
  author: string;
  checked?: string;
  approved?: string;
}

export const ReportDocumentControl: React.FC<{
  meta: ReportMetadata;
  revisions?: RevisionRow[];
}> = ({ meta, revisions }) => {
  const rows: RevisionRow[] = revisions ?? [{
    rev: meta.revision,
    date: meta.date,
    description: 'Initial issue for review',
    author: meta.preparedBy,
    checked: meta.checkedBy ?? '—',
    approved: meta.approvedBy ?? '—',
  }];

  return (
    <>
      <ReportSubHeading num="0.1" title="Revision History" />
      <ReportTable
        headers={['Rev', 'Date', 'Description', 'Author', 'Checked', 'Approved']}
        rows={rows.map(r => [r.rev, r.date, r.description, r.author, r.checked ?? '—', r.approved ?? '—'])}
        rightAlignFrom={99}
      />
      <ReportSubHeading num="0.2" title="Signatories" />
      <div className="border border-slate-300 rounded-sm overflow-hidden text-[11px] mb-5">
        <table className="w-full text-left">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50 w-1/3">Prepared by</td>
              <td className="px-3 py-2">{meta.preparedBy}</td>
            </tr>
            {meta.checkedBy && (
              <tr className="border-b border-slate-200">
                <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Checked by</td>
                <td className="px-3 py-2">{meta.checkedBy}</td>
              </tr>
            )}
            {meta.approvedBy && (
              <tr>
                <td className="px-3 py-2 font-bold text-slate-500 bg-slate-50">Approved by</td>
                <td className="px-3 py-2">{meta.approvedBy}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─── ReportFooter ─────────────────────────────────────────────────────────────

export const ReportFooter: React.FC<{
  meta: ReportMetadata;
  branding?: BrandingConfig;
  pageLabel?: string;
}> = ({ meta, branding = DEFAULT_BRANDING, pageLabel }) => (
  <div className="mt-10 px-12 md:px-16 py-4 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400">
    <span>{branding.disclaimer}</span>
    <span className="font-mono">{meta.docRef} Rev {meta.revision}{pageLabel ? ` — ${pageLabel}` : ''}</span>
  </div>
);

// ─── ReportDisclaimer ─────────────────────────────────────────────────────────

export const ReportDisclaimer: React.FC<{ branding?: BrandingConfig }> = ({
  branding = DEFAULT_BRANDING,
}) => (
  <div className="mt-10 p-4 border border-amber-200 bg-amber-50 rounded text-[10px] text-amber-800">
    <strong>DISCLAIMER:</strong> This report has been generated by {branding.companyName} for
    structural analysis and design purposes only.{' '}
    {branding.disclaimer}
    {' '}Results should be independently verified before use in construction.
  </div>
);

// ─── Shared Page Wrapper (non-cover pages) ────────────────────────────────────

export const ReportPageBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`px-12 md:px-16 print:px-0 pb-8 ${className}`}>
    {children}
  </div>
);

// ─── Re-export branding default for convenience ───────────────────────────────

export { DEFAULT_BRANDING } from '../../services/ReportTemplateService';
export type { BrandingConfig, ReportMetadata, KpiCardData, StatusPillValue } from '../../types/ReportTypes';
export { BEAMLAB_COLORS };
