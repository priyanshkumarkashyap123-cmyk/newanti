/**
 * ReportTemplateService.ts
 *
 * Centralized utility functions for building report markup (HTML strings)
 * and PDF layout primitives that can be consumed by all report generators.
 *
 * All functions follow the visual standard established by ReportsPage.tsx
 * (navy #12376A accent bars, gold #BF9B30 stripe, Inter typeface).
 */

import {
  BEAMLAB_COLORS,
  BEAMLAB_COMPANY,
  BEAMLAB_LOGO,
  REPORT_FONT_STACK,
  REPORT_MONO_STACK,
} from '../constants/BrandingConstants';
import type { BrandingConfig, ReportMetadata, KpiCardData, StatusPillValue } from '../types/ReportTypes';

// ─── Default Branding Config ────────────────────────────────────────────────

/** Ready-to-use default config — override only the fields you need */
export const DEFAULT_BRANDING: BrandingConfig = {
  companyName: BEAMLAB_COMPANY.name,
  tagline: BEAMLAB_COMPANY.tagline,
  website: BEAMLAB_COMPANY.website,
  email: BEAMLAB_COMPANY.email,
  logoSrc: BEAMLAB_LOGO.iconColored,
  primaryColor: BEAMLAB_COLORS.navy,
  accentColor: BEAMLAB_COLORS.gold,
  disclaimer: BEAMLAB_COMPANY.disclaimer,
};

// ─── Engineering Format Utilities ───────────────────────────────────────────

/** Format a number with engineering notation and thousands separator */
export const formatEngNum = (v: number | undefined | null, decimals = 2): string => {
  if (v === undefined || v === null || isNaN(v as number)) return '—';
  return (v as number).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/** Format a date object to long-form string (e.g. "March 12, 2026") */
export const formatReportDate = (d: Date): string =>
  d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

/** Format a date object to time string (e.g. "09:41 AM") */
export const formatReportTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/**
 * Generate a deterministic document reference from node/member counts.
 * Stable across renders so the ref never changes for the same model.
 */
export const generateDocRef = (nodeCount: number, memberCount: number): string =>
  `BL-${String(nodeCount * 37 + memberCount * 53 + 1000).padStart(5, '0')}`;

// ─── HTML Report Fragment Builders ──────────────────────────────────────────
//
// Each function returns an HTML string suitable for:
//   • Injecting into an innerHTML / dangerouslySetInnerHTML (after sanitizing)
//   • Embedding in the ProfessionalReportGenerator's HTML preview
//   • Building standalone HTML exports
//
// SECURITY: These functions only accept typed structured data — no raw
// user-provided HTML blobs are passed in. All string interpolation uses
// structured fields only.

const C = BEAMLAB_COLORS;
const MONO = REPORT_MONO_STACK;
const FONT = REPORT_FONT_STACK;

/** Inline style string for section headings */
const sectionHeadingStyle = (navyColor = C.navy) =>
  `font-family:${FONT};font-size:15px;font-weight:800;text-transform:uppercase;` +
  `letter-spacing:0.05em;color:${C.slate900};border-bottom:2px solid ${C.slate200};` +
  `padding-bottom:6px;margin:28px 0 16px 0;display:flex;align-items:baseline;gap:8px;`;

/** Section number badge style */
const sectionNumStyle = () =>
  `font-size:11px;font-weight:900;color:${C.slate500};` +
  `font-family:${MONO};letter-spacing:0.1em;`;

/** Sub-heading style */
const subHeadingStyle = () =>
  `font-family:${FONT};font-size:13px;font-weight:700;color:${C.slate700};` +
  `border-bottom:1px solid ${C.slate200};padding-bottom:4px;margin:20px 0 10px 0;`;

/** Table header cell style */
const thStyle = () =>
  `padding:8px 12px;font-size:11px;font-weight:700;color:${C.slate600};` +
  `background:${C.slate100};text-align:left;border:1px solid ${C.slate200};`;

/** Table data cell style */
const tdStyle = (alt = false) =>
  `padding:6px 12px;font-size:11px;color:${C.slate700};` +
  `background:${alt ? C.slate50 : C.white};border:1px solid ${C.slate200};`;

// ──────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Render the full-page HTML cover block for a report.
 * Matches the ReportsPage.tsx cover page layout exactly.
 */
export function buildCoverPageHTML(
  meta: ReportMetadata,
  branding: BrandingConfig = DEFAULT_BRANDING,
): string {
  const statusColor =
    meta.status === 'Draft' ? C.amber :
    meta.status === 'Issued for Construction' ? C.green :
    meta.status === 'Superseded' ? C.slate500 :
    '#2563EB'; // Issued for Review → blue

  return `
<div style="position:relative;min-height:297mm;display:flex;flex-direction:column;
  justify-content:space-between;padding:64px;font-family:${FONT};page-break-after:always;">

  <!-- Navy accent bar -->
  <div style="position:absolute;top:0;left:0;right:0;height:6px;background:${branding.primaryColor};"></div>
  <!-- Gold stripe -->
  <div style="position:absolute;top:6px;left:0;right:0;height:3px;background:${branding.accentColor};"></div>

  <!-- Header — branding + meta -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-top:12px;">
    <div style="display:flex;align-items:center;gap:16px;">
      <img src="${branding.logoSrc}" alt="${branding.companyName}" width="56" height="56"
        style="object-fit:contain;" onerror="this.style.display='none'" />
      <div>
        <div style="font-size:22px;font-weight:900;color:${C.slate900};letter-spacing:-0.02em;
          line-height:1;">${branding.companyName}</div>
        <div style="font-size:9px;font-weight:700;color:${C.slate500};text-transform:uppercase;
          letter-spacing:0.25em;margin-top:3px;">${branding.tagline}</div>
      </div>
    </div>
    <div style="font-size:8px;color:${C.slate500};text-align:right;line-height:1.7;">
      <div>${branding.website}</div>
      <div>${branding.email}</div>
    </div>
  </div>

  <!-- Centre title block -->
  <div style="flex:1;display:flex;flex-direction:column;align-items:center;
    justify-content:center;text-align:center;margin-top:-48px;">
    <div style="width:60px;height:2px;background:${C.slate200};margin:0 auto 28px;"></div>
    <div style="font-size:10px;font-weight:700;color:${C.slate500};text-transform:uppercase;
      letter-spacing:0.3em;margin-bottom:12px;">${meta.reportType}</div>
    <h1 style="font-size:30px;font-weight:900;color:${branding.primaryColor};
      line-height:1.2;margin:16px 0;max-width:480px;">${meta.projectName}</h1>
    <div style="font-size:11px;color:${C.slate500};margin:4px 0;">
      Document Ref: <span style="font-family:${MONO};font-weight:700;">${meta.docRef}</span>
    </div>
    <div style="font-size:11px;color:${C.slate500};">
      Revision <span style="font-family:${MONO};">${meta.revision}</span> &mdash; ${meta.date}
    </div>
    <div style="width:60px;height:2px;background:${C.slate200};margin:28px auto 0;"></div>
    ${meta.client ? `<div style="margin-top:20px;font-size:12px;color:${C.slate600};">Client: ${meta.client}</div>` : ''}
    ${meta.location ? `<div style="font-size:12px;color:${C.slate600};">Location: ${meta.location}</div>` : ''}
  </div>

  <!-- Document control table -->
  <div style="border:1px solid ${C.slate300};border-radius:4px;overflow:hidden;
    font-family:${FONT};font-size:10px;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="${tdStyle(true)}font-weight:700;color:${C.slate500};width:20%;">Project</td>
        <td style="${tdStyle()}">${meta.projectName}</td>
        <td style="${tdStyle(true)}font-weight:700;color:${C.slate500};width:20%;">Document No.</td>
        <td style="${tdStyle()}font-family:${MONO};">${meta.docRef}</td>
      </tr>
      <tr>
        <td style="${tdStyle(true)}font-weight:700;color:${C.slate500};">Prepared by</td>
        <td style="${tdStyle()}">${meta.preparedBy}</td>
        <td style="${tdStyle(true)}font-weight:700;color:${C.slate500};">Date</td>
        <td style="${tdStyle()}">${meta.date}</td>
      </tr>
      <tr>
        <td style="${tdStyle(true)}font-weight:700;color:${C.slate500};">Status</td>
        <td style="${tdStyle()}color:${statusColor};font-weight:700;">${meta.status}</td>
        <td style="${tdStyle(true)}font-weight:700;color:${C.slate500};">Revision</td>
        <td style="${tdStyle()}font-family:${MONO};">${meta.revision}</td>
      </tr>
    </table>
  </div>
</div>`;
}

/**
 * Running header bar — shown on-screen above report body.
 * (Print uses @page CSS media rules instead.)
 */
export function buildRunningHeaderHTML(
  meta: ReportMetadata,
  branding: BrandingConfig = DEFAULT_BRANDING,
): string {
  return `
<div style="display:flex;align-items:center;justify-content:space-between;
  padding:8px 64px;border-bottom:2px solid ${branding.primaryColor};
  background:${C.slate50};font-size:10px;color:${C.slate600};font-family:${FONT};">
  <span style="font-weight:700;letter-spacing:0.05em;">
    ${branding.companyName} &mdash; ${meta.docRef}
  </span>
  <span>Rev ${meta.revision}&nbsp;|&nbsp;${meta.date}</span>
</div>`;
}

/**
 * Branded footer bar for the bottom of each report page.
 */
export function buildFooterHTML(
  meta: ReportMetadata,
  branding: BrandingConfig = DEFAULT_BRANDING,
): string {
  return `
<div style="margin-top:32px;padding-top:12px;border-top:1px solid ${C.slate300};
  display:flex;align-items:center;justify-content:space-between;
  font-size:9px;color:${C.slate500};font-family:${FONT};">
  <span>${branding.disclaimer}</span>
  <span style="font-family:${MONO};">${meta.docRef} Rev ${meta.revision}</span>
</div>`;
}

/**
 * Section heading with auto-numbering — matches ReportsPage SectionHeading component.
 */
export function buildSectionHeadingHTML(num: string, title: string): string {
  return `
<div style="${sectionHeadingStyle()}">
  <span style="${sectionNumStyle()}">${num}</span>
  <span>${title}</span>
</div>`;
}

export function buildSubHeadingHTML(num: string, title: string): string {
  return `<div style="${subHeadingStyle()}">
  <span style="font-family:${MONO};font-weight:700;color:${C.slate500};
    font-size:11px;margin-right:6px;">${num}</span>
  <span>${title}</span>
</div>`;
}

/**
 * Build a KPI card grid from an array of KpiCardData.
 */
export function buildKpiGridHTML(kpis: KpiCardData[]): string {
  const cards = kpis.map((k) => {
    const borderColor =
      k.status === 'pass' ? '#16A34A' :
      k.status === 'warn' ? '#D97706' :
      k.status === 'fail' ? '#DC2626' :
      '#3B82F6';
    return `
<div style="border:1px solid ${C.slate200};border-left:4px solid ${borderColor};
  border-radius:2px;padding:10px 14px;background:${C.white};">
  <div style="font-size:9px;font-weight:700;color:${C.slate500};
    text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">${k.label}</div>
  <div style="font-size:18px;font-weight:900;color:${C.slate900};line-height:1.2;">
    ${k.value}
    ${k.unit ? `<span style="font-size:10px;font-weight:500;color:${C.slate500};margin-left:3px;">${k.unit}</span>` : ''}
  </div>
</div>`;
  }).join('');
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));
    gap:8px;margin-bottom:16px;">${cards}</div>`;
}

/** Inline status pill — PASS / FAIL / WARN / N/A */
export function buildStatusPillHTML(status: StatusPillValue): string {
  const styles: Record<StatusPillValue, string> = {
    PASS: `background:${C.greenBg};color:${C.green};border-color:#BBF7D0;`,
    FAIL: `background:${C.redBg};color:${C.red};border-color:#FECACA;`,
    WARN: `background:${C.amberBg};color:${C.amber};border-color:#FDE68A;`,
    'N/A': `background:${C.slate100};color:${C.slate500};border-color:${C.slate300};`,
  };
  return `<span style="display:inline-flex;align-items:center;gap:4px;
    font-size:9px;font-weight:700;text-transform:uppercase;
    padding:2px 8px;border-radius:2px;border:1px solid transparent;
    ${styles[status]}">${status}</span>`;
}

/**
 * Build a professional HTML table.
 * @param headers — Column header labels
 * @param rows — 2D array of cell values (string/number)
 * @param rightAlignFrom — column index from which to right-align (defaults to 1)
 */
export function buildTableHTML(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  rightAlignFrom = 1,
): string {
  const ths = headers.map((h, i) => {
    const align = i >= rightAlignFrom ? 'right' : 'left';
    return `<th style="${thStyle()}text-align:${align};">${h}</th>`;
  }).join('');

  const trs = rows.map((row, ri) => {
    const alt = ri % 2 === 1;
    const tds = row.map((cell, ci) => {
      const align = ci >= rightAlignFrom ? 'right' : 'left';
      const val = cell === undefined || cell === null ? '—' : cell;
      return `<td style="${tdStyle(alt)}text-align:${align};">${val}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  return `
<div style="border:1px solid ${C.slate200};border-radius:4px;overflow:hidden;margin-bottom:16px;">
  <table style="width:100%;border-collapse:collapse;">
    <thead><tr>${ths}</tr></thead>
    <tbody>${trs}</tbody>
  </table>
</div>`;
}

/**
 * @page CSS block for print media — embeds running header/footer into printed pages.
 * Inject into a <style> tag in the document head when printing.
 */
export function buildPrintPageCSS(
  meta: ReportMetadata,
  branding: BrandingConfig = DEFAULT_BRANDING,
): string {
  return `
@media print {
  @page {
    size: A4 portrait;
    margin: 20mm 15mm 25mm 15mm;
    @top-left   { content: "${branding.companyName} — ${meta.docRef}"; font-size: 8pt; color: #94a3b8; }
    @top-right  { content: "Rev ${meta.revision}  |  ${meta.date}"; font-size: 8pt; color: #94a3b8; }
    @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #94a3b8; }
    @bottom-left { content: "${branding.disclaimer}"; font-size: 7pt; color: #cbd5e1; }
  }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;
}

/**
 * Wrap section HTML with the full A4 document shell (fonts + print styles).
 * Use this when producing a standalone HTML file for download.
 */
export function wrapInDocumentShell(
  bodyHTML: string,
  meta: ReportMetadata,
  branding: BrandingConfig = DEFAULT_BRANDING,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${meta.reportType} — ${meta.projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: ${REPORT_FONT_STACK}; background: #f1f5f9; }
    .report-doc {
      max-width: 210mm;
      margin: 32px auto;
      background: #fff;
      box-shadow: 0 4px 24px rgba(0,0,0,0.12);
    }
    ${buildPrintPageCSS(meta, branding)}
    @media print {
      body { background: #fff; }
      .report-doc { margin: 0; box-shadow: none; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="report-doc">
    ${bodyHTML}
  </div>
</body>
</html>`;
}
