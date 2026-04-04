import { Building2, Compass, Droplets, Eye, LayoutGrid, Palette, PanelTopOpen, Settings2, Sun, Table2, Thermometer, Wind, Zap } from 'lucide-react';
import type { OverlayMode } from '../components/space-planning/FloorPlanRenderer';
import type { ConstraintReport } from '../services/space-planning/layoutApiService';

export type PlanTab =
  | 'wizard'
  | 'floor_plan'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'vastu'
  | 'sunlight'
  | 'airflow'
  | 'elevations'
  | 'sections'
  | 'colors'
  | 'schedule';

export const PLAN_TABS: { key: PlanTab; label: string; icon: typeof Building2; group: string }[] = [
  { key: 'wizard', label: 'Configure', icon: Settings2, group: 'Setup' },
  { key: 'floor_plan', label: 'Floor Plan', icon: LayoutGrid, group: 'Architectural' },
  { key: 'structural', label: 'Structural', icon: Building2, group: 'Structural' },
  { key: 'electrical', label: 'Electrical', icon: Zap, group: 'MEP' },
  { key: 'plumbing', label: 'Plumbing', icon: Droplets, group: 'MEP' },
  { key: 'hvac', label: 'HVAC', icon: Wind, group: 'MEP' },
  { key: 'vastu', label: 'Vastu', icon: Compass, group: 'Analysis' },
  { key: 'sunlight', label: 'Sunlight', icon: Sun, group: 'Analysis' },
  { key: 'airflow', label: 'Airflow', icon: Thermometer, group: 'Analysis' },
  { key: 'elevations', label: 'Elevations', icon: Eye, group: 'Drawings' },
  { key: 'sections', label: 'Sections', icon: PanelTopOpen, group: 'Drawings' },
  { key: 'colors', label: 'Colors', icon: Palette, group: 'Finishes' },
  { key: 'schedule', label: 'Schedule', icon: Table2, group: 'Documents' },
];

export function getOverlayForTab(tab: PlanTab): OverlayMode {
  switch (tab) {
    case 'structural':
      return 'structural';
    case 'electrical':
      return 'electrical';
    case 'plumbing':
      return 'plumbing';
    case 'hvac':
      return 'hvac';
    default:
      return 'none';
  }
}

export function parseSolverError(err: unknown): string {
  if (err && typeof err === 'object') {
    const anyErr = err as Record<string, unknown>;
    const status = typeof anyErr.status === 'number' ? anyErr.status : undefined;
    const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
    const message = typeof anyErr.message === 'string' ? anyErr.message : undefined;

    if (status === 404) return 'Optimization service route not found (HTTP 404).';
    if (status === 0 || code === 'NETWORK_ERROR') return 'Optimization service is currently unreachable.';
    if (status && status >= 500) return `Optimization service error (HTTP ${status}).`;
    if (status && status >= 400) return `Optimization request failed (HTTP ${status}).`;
    if (code === 'TIMEOUT') return 'Optimization request timed out. Please retry.';
    if (message) return message;
  }

  if (err instanceof Error && err.message) return err.message;
  return 'Unknown solver error.';
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildConstraintReportPdfHtml(constraintReport: ConstraintReport, selectedFloor: number): string {
  const rows = constraintReport.violations
    .map(
      (v) =>
        `<tr>
          <td>${escapeHtml(v.domain)}</td>
          <td>${v.passed ? 'PASS' : 'FAIL'}</td>
          <td>${escapeHtml(v.severity)}</td>
          <td>${escapeHtml(v.message)}</td>
          <td>${escapeHtml(v.clause || '-')}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Constraint Report</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #111827; }
      h1 { margin: 0 0 8px 0; font-size: 20px; }
      .meta { margin-bottom: 16px; color: #4b5563; font-size: 12px; }
      .chips { display: flex; gap: 8px; margin-bottom: 12px; }
      .chip { padding: 4px 8px; border-radius: 999px; border: 1px solid #d1d5db; font-size: 12px; }
      table { border-collapse: collapse; width: 100%; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 6px; vertical-align: top; text-align: left; }
      th { background: #f9fafb; }
      .pass { color: #15803d; font-weight: 700; }
      .fail { color: #b91c1c; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>Constraint Compliance Report</h1>
    <div class="meta">Generated ${escapeHtml(new Date().toLocaleString())} • Floor ${selectedFloor}</div>
    <div class="chips">
      <div class="chip">Score: ${constraintReport.score}%</div>
      <div class="chip">Domains: ${constraintReport.constraintsMet}/${constraintReport.constraintsTotal}</div>
      <div class="chip">Penalty: ${constraintReport.totalPenalty.toFixed(0)}</div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Domain</th>
          <th>Status</th>
          <th>Severity</th>
          <th>Message</th>
          <th>Clause</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <script>
      // Printing is handled by the unified PDF/report pipeline.
    </script>
  </body>
</html>`;
}