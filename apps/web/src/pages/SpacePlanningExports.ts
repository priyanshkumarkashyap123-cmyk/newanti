import type { LayoutVariantsResponse, VariantResponse } from '../services/space-planning/layoutApiService';
import type { ConstraintReport, PlacementResponse } from '../services/space-planning/layoutApiService';
import type { WizardConfig } from '../components/space-planning/RoomConfigWizard';

const safeFileName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-');

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const buildVariantExport = (
  variant: VariantResponse,
  layoutVariantsResult: LayoutVariantsResponse | null,
  selectedFloor: number,
  lastWizardConfig: WizardConfig | null,
) => {
  const payload = {
    export_type: 'space_planning_variant',
    exported_at: new Date().toISOString(),
    variant,
    recommendation: layoutVariantsResult?.recommendation ?? null,
    selected_floor: selectedFloor,
    wizard_config: lastWizardConfig,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const safeName = safeFileName(variant.strategy_name || variant.variant_id);
  return { blob, filename: `space-plan-variant-${safeName || variant.variant_id}.json` };
};

export const buildConstraintJsonExport = (
  constraintReport: ConstraintReport,
  selectedFloor: number,
  solverPlacements: PlacementResponse[] | null,
  lastWizardConfig: WizardConfig | null,
) => {
  const payload = {
    export_type: 'space_planning_constraint_report',
    exported_at: new Date().toISOString(),
    selected_floor: selectedFloor,
    report: constraintReport,
    placements: solverPlacements ?? [],
    wizard_config: lastWizardConfig,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  return { blob, filename: `constraint-report-floor-${selectedFloor}.json` };
};

export const buildConstraintPdfHtml = (
  constraintReport: ConstraintReport,
  selectedFloor: number,
) => {
  const esc = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const rows = constraintReport.violations
    .map(
      (v) =>
        `<tr>
            <td>${esc(v.domain)}</td>
            <td>${v.passed ? 'PASS' : 'FAIL'}</td>
            <td>${esc(v.severity)}</td>
            <td>${esc(v.message)}</td>
            <td>${esc(v.clause || '-')}</td>
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
    <div class="meta">Generated ${esc(new Date().toLocaleString())} • Floor ${selectedFloor}</div>
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
      // Printing was previously auto-invoked via setTimeout(window.print).
      // We no longer auto-print; callers must explicitly trigger print if needed.
    </script>
  </body>
</html>`;
};
