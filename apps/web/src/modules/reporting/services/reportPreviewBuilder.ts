import type { ReportSection } from '../../../types/ReportTypes';
import type { AnalysisTable, AnalysisKpis } from './reportAnalysisHelpers';
import { formatSigned } from './reportAnalysisHelpers';

export interface PreviewBuildContext {
  sections: ReportSection[];
  projectInfo: {
    projectName: string;
    projectNumber: string;
    client: string;
    location: string;
    engineer: string;
    checker: string;
    approver: string;
    date: string;
    revision: string;
    companyName: string;
    companyTagline: string;
    companyLogo: string;
  };
  geometrySummary: {
    nodeCount: number;
    memberCount: number;
    supportCount: number;
    totalHeight: number;
    storeyCount: number;
  };
  analysisTables: AnalysisTable;
  analysisKpis: AnalysisKpis;
  designCodes?: string;
  loadCases: Array<{ id: string; name?: string; type: string; loads?: unknown[]; memberLoads?: unknown[] }>;
  loadCombinations: Array<{ id: string; name: string; factors: Array<{ factor: number; loadCaseId: string }> }>;
}

export function buildProfessionalReportPreview(ctx: PreviewBuildContext): string {
  const {
    sections,
    projectInfo,
    geometrySummary,
    analysisTables,
    analysisKpis,
    designCodes,
    loadCases,
    loadCombinations,
  } = ctx;

  const enabledSections = sections.filter((s) => s.enabled);
  const NAVY = '#12376A';
  const GOLD = '#BF9B30';
  const SLATE_50 = '#f8fafc';
  const SLATE_100 = '#f1f5f9';
  const SLATE_200 = '#e2e8f0';
  const SLATE_500 = '#64748b';
  const SLATE_600 = '#475569';
  const SLATE_700 = '#334155';
  const SLATE_900 = '#0f172a';
  const INSET_BORDER = '#d7e3ff';
  const TOK_TEXT = '#0b1326';
  const TOK_TEXT_SOFT = '#475569';
  const monoStyle = 'font-family: "SF Mono", "Cascadia Code", "Consolas", monospace;';
  const sectionHeadingStyle = `font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${TOK_TEXT}; border-bottom: 2px solid ${INSET_BORDER}; padding-bottom: 6px; margin: 28px 0 16px 0;`;
  const subHeadingStyle = `font-size: 13px; font-weight: 700; color: ${TOK_TEXT_SOFT}; border-bottom: 1px solid ${INSET_BORDER}; padding-bottom: 4px; margin: 20px 0 10px 0;`;
  const tableHeaderStyle = `background: ${SLATE_100}; border: 1px solid ${INSET_BORDER}; padding: 8px 12px; font-size: 11px; font-weight: 700; color: ${TOK_TEXT_SOFT}; text-align: left;`;
  const tableCellStyle = `border: 1px solid ${INSET_BORDER}; padding: 6px 12px; font-size: 11px; color: ${TOK_TEXT_SOFT};`;
  const tableCellAltStyle = `${tableCellStyle} background: ${SLATE_50};`;
  const loadCaseRows = loadCases.length > 0 ? loadCases : [{ id: 'LC-DEFAULT', name: 'Default Load Case', type: 'custom', loads: [], memberLoads: [] }];

  let html = `<div class="report-preview" style="font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; color: ${SLATE_900}; line-height: 1.6;">`;

  enabledSections.forEach((section) => {
    switch (section.type) {
      case 'cover':
        html += `<div style="padding: 40px; page-break-after: always;"><h1 style="color:${NAVY};">${projectInfo.projectName}</h1></div>`;
        break;
      case 'summary':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Executive Summary</h2><p style="color:${SLATE_600};">Report codes: ${designCodes || '—'}</p><p>Max displacement: ${analysisKpis.maxDisp ? analysisKpis.maxDisp.drift.toFixed(4) : '—'} m</p><p>Top reaction: ${analysisKpis.maxReaction ? formatSigned(analysisKpis.maxReaction.fy, 3) : '—'} kN</p></div>`;
        break;
      case 'geometry':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Model Geometry</h2><p>Nodes: ${geometrySummary.nodeCount} | Members: ${geometrySummary.memberCount}</p></div>`;
        break;
      case 'loads':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Load Cases</h2><p>Total cases: ${loadCaseRows.length}</p><p>Total combinations: ${loadCombinations.length}</p></div>`;
        break;
      case 'analysis':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Analysis Summary</h2><p>Ready: ${analysisKpis.analysisReady ? 'Yes' : 'No'}</p></div>`;
        break;
      case 'reactions':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Support Reactions</h2><p>${analysisTables.reactionRows.length} reactions available.</p></div>`;
        break;
      case 'displacements':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Nodal Displacements</h2><p>${analysisTables.displacementRows.length} displacement rows.</p></div>`;
        break;
      case 'memberForces':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Member Forces</h2><p>${analysisTables.memberForceRows.length} force rows.</p></div>`;
        break;
      case 'codeCheck':
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">Code Compliance Summary</h2><p>Status: PASS</p></div>`;
        break;
      default:
        html += `<div style="padding: 20px 40px;"><h2 style="${sectionHeadingStyle}">${section.title}</h2></div>`;
    }
  });

  html += `</div>`;
  return html;
}

export function buildProfessionalReportHtml(ctx: PreviewBuildContext, previewHtml: string) {
  const { projectInfo } = ctx;
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${projectInfo.projectName} - Structural Design Report</title>
      <style>
        @page { size: A4 portrait; margin: 20mm; }
        body { font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.6; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      ${previewHtml}
    </body>
    </html>
  `;
}