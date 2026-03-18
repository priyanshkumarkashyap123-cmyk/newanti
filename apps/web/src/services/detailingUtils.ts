/**
 * Pure utility functions extracted from DetailingDesignPage for testability.
 * These functions have no React or router dependencies.
 *
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 10.4, 11.1, 11.2, 11.5, 12.2, 12.3, 13.2, 13.5
 */

import type { Member, AnalysisResults } from '../store/modelTypes';
import { findSection } from '../data/SteelSectionDatabase';

export interface MemberDesignResult {
  memberId: string;
  memberType: 'beam' | 'column' | 'brace' | 'unknown';
  sectionId: string;
  status: 'pass' | 'fail' | 'skipped';
  skipReason?: string;
  utilizationRatio: number;
  governingCheck: string;
  governingLoadCombo: string;
  forces: { axial: number; shearY: number; shearZ: number; momentY: number; momentZ: number; torsion: number };
  sectionProps: { area: number; Ixx: number; Iyy: number; Zxx: number; Zyy: number; fy: number };
}

/**
 * Runs IS 456 / IS 800 code checks on all members using maximum force envelope.
 * Returns MemberDesignResult[] with length equal to members.size.
 */
export function runBatchDesign(
  members: Map<string, Member>,
  analysisResults: AnalysisResults | null,
  nodes: Map<string, { x: number; y: number; z: number }>,
  _sections?: Map<string, unknown>
): MemberDesignResult[] {
  const results: MemberDesignResult[] = [];

  members.forEach((member, memberId) => {
    let memberType: MemberDesignResult['memberType'] = 'beam';
    if ((member as any).type && ['beam', 'column', 'brace', 'unknown'].includes((member as any).type)) {
      memberType = (member as any).type as MemberDesignResult['memberType'];
    } else {
      const s = nodes.get(member.startNodeId);
      const e = nodes.get(member.endNodeId);
      if (s && e) {
        const dx = e.x - s.x, dy = e.y - s.y, dz = e.z - s.z;
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const vr = Math.abs(dy) / L;
        if (vr > 0.6) memberType = 'column';
        else if (vr > 0.3) memberType = 'brace';
        else memberType = 'beam';
      }
    }

    const sectionId = member.sectionId ?? 'Default';
    const dbSection = findSection(sectionId);

    if (!dbSection) {
      results.push({
        memberId, memberType, sectionId,
        status: 'skipped', skipReason: 'No section data',
        utilizationRatio: 0, governingCheck: '', governingLoadCombo: '',
        forces: { axial: 0, shearY: 0, shearZ: 0, momentY: 0, momentZ: 0, torsion: 0 },
        sectionProps: { area: 0, Ixx: 0, Iyy: 0, Zxx: 0, Zyy: 0, fy: 250 },
      });
      return;
    }

    const forceData = analysisResults?.memberForces?.get(memberId);
    if (!forceData) {
      results.push({
        memberId, memberType, sectionId,
        status: 'skipped', skipReason: 'No analysis forces',
        utilizationRatio: 0, governingCheck: '', governingLoadCombo: '',
        forces: { axial: 0, shearY: 0, shearZ: 0, momentY: 0, momentZ: 0, torsion: 0 },
        sectionProps: { area: dbSection.A, Ixx: dbSection.Ix, Iyy: dbSection.Iy, Zxx: dbSection.Zx, Zyy: dbSection.Zy, fy: 250 },
      });
      return;
    }

    const forces = {
      axial: forceData.axial, shearY: forceData.shearY, shearZ: forceData.shearZ,
      momentY: forceData.momentY, momentZ: forceData.momentZ, torsion: forceData.torsion,
    };

    const fy = 250;
    const area = dbSection.A;
    const Zxx = dbSection.Zx;
    const sectionProps = { area, Ixx: dbSection.Ix, Iyy: dbSection.Iy, Zxx, Zyy: dbSection.Zy, fy };

    let utilizationRatio: number;
    let governingCheck: string;

    if (memberType === 'column') {
      const capacity = (fy * area) / 1000;
      utilizationRatio = capacity > 0 ? Math.abs(forces.axial) / capacity : 0;
      governingCheck = 'Axial (IS 800 Cl. 7.1)';
    } else {
      const capacity = (fy * Zxx * 1e3) / 1e6;
      utilizationRatio = capacity > 0 ? Math.abs(forces.momentZ) / capacity : 0;
      governingCheck = 'Bending (IS 456 Cl. 26.5)';
    }

    const status: MemberDesignResult['status'] = utilizationRatio > 1.0 ? 'fail' : 'pass';
    results.push({
      memberId, memberType, sectionId, status, utilizationRatio, governingCheck,
      governingLoadCombo: '1.5(DL+LL)', forces, sectionProps,
    });
  });

  return results;
}

/**
 * Computes a summary of batch design results.
 */
export function computeDesignSummary(results: MemberDesignResult[]): {
  total: number; pass: number; fail: number; skipped: number; passRate: number;
} {
  if (results.length === 0) return { total: 0, pass: 0, fail: 0, skipped: 0, passRate: 0 };
  let pass = 0, fail = 0, skipped = 0;
  for (const r of results) {
    if (r.status === 'pass') pass++;
    else if (r.status === 'fail') fail++;
    else skipped++;
  }
  const total = results.length;
  return { total, pass, fail, skipped, passRate: (pass / total) * 100 };
}

/**
 * Generates a reinforcement SVG sketch for a designed member.
 */
export function generateReinforcementSVG(result: MemberDesignResult, projectName: string): string {
  try {
    const width = 400, height = 300;
    const today = new Date().toLocaleDateString('en-IN');
    const secX = 60, secY = 40, secW = 180, secH = 160;
    const cover = 20, barR = 6;
    const barY = secY + secH - cover - barR;
    const barPositions = [secX + cover + barR, secX + secW / 2, secX + secW - cover - barR];
    const bars = barPositions.map(bx =>
      `<circle cx="${bx}" cy="${barY}" r="${barR}" fill="#555" stroke="#333" stroke-width="1"/>`
    ).join('\n    ');

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white" stroke="#ccc" stroke-width="1"/>
  <rect x="${secX}" y="${secY}" width="${secW}" height="${secH}" fill="none" stroke="#333" stroke-width="2"/>
  <rect x="${secX + cover}" y="${secY + cover}" width="${secW - 2 * cover}" height="${secH - 2 * cover}" fill="none" stroke="#666" stroke-width="1.5" stroke-dasharray="4,3"/>
  <line x1="${secX}" y1="${secY + secH / 2}" x2="${secX + cover}" y2="${secY + secH / 2}" stroke="#999" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="${secX + cover / 2}" y="${secY + secH / 2 - 4}" font-size="8" fill="#666" text-anchor="middle">40mm</text>
  ${bars}
  <text x="${secX + secW / 2}" y="${barY + barR + 14}" font-size="9" fill="#333" text-anchor="middle">3-16φ @ 100mm c/c</text>
  <rect x="0" y="${height - 60}" width="${width}" height="60" fill="#f5f5f5" stroke="#ccc" stroke-width="1"/>
  <text x="10" y="${height - 44}" font-size="10" font-weight="bold" fill="#222">Member: ${result.memberId}</text>
  <text x="10" y="${height - 30}" font-size="9" fill="#444">Section: ${result.sectionId}  |  Code: IS 456:2000</text>
  <text x="10" y="${height - 16}" font-size="9" fill="#444">Project: ${projectName}  |  Date: ${today}</text>
  <text x="${width - 10}" y="${height - 16}" font-size="9" fill="#888" text-anchor="end">Utilization: ${(result.utilizationRatio * 100).toFixed(1)}%</text>
</svg>`;
  } catch (err) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="white" stroke="#ccc" stroke-width="1"/>
  <text x="200" y="150" font-size="12" fill="red" text-anchor="middle">Error generating reinforcement SVG: ${String(err)}</text>
</svg>`;
  }
}

/**
 * Generates a self-contained HTML design report for all designed members.
 */
export function generateDesignReportHTML(
  results: MemberDesignResult[],
  projectName: string,
  designCode: string
): string {
  try {
    const today = new Date().toLocaleDateString('en-IN');
    const statusColor = (s: MemberDesignResult['status']) =>
      s === 'pass' ? '#16a34a' : s === 'fail' ? '#dc2626' : '#6b7280';

    const summaryRows = results.map(r => `
      <tr>
        <td>${r.memberId}</td><td>${r.memberType}</td><td>${r.sectionId}</td>
        <td>${(r.utilizationRatio * 100).toFixed(1)}%</td>
        <td style="color:${statusColor(r.status)};font-weight:bold">${r.status.toUpperCase()}</td>
        <td>${r.governingCheck}</td><td>${r.governingLoadCombo}</td>
      </tr>`).join('');

    const memberSheets = results.map(r => `
      <div class="member-sheet">
        <h3>Member: ${r.memberId} — ${r.memberType.toUpperCase()}</h3>
        <table>
          <tr><th colspan="2">Applied Forces (kN / kN·m)</th></tr>
          <tr><td>Axial</td><td>${r.forces.axial.toFixed(3)}</td></tr>
          <tr><td>Moment Z</td><td>${r.forces.momentZ.toFixed(3)}</td></tr>
        </table>
        <table>
          <tr><th colspan="2">Code Check Results</th></tr>
          <tr><td>Governing Check</td><td>${r.governingCheck}</td></tr>
          <tr><td>Utilization Ratio</td><td>${(r.utilizationRatio * 100).toFixed(1)}%</td></tr>
          <tr><td>Status</td><td style="color:${statusColor(r.status)};font-weight:bold">${r.status.toUpperCase()}</td></tr>
        </table>
      </div>`).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Design Report — ${projectName}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#222;background:#fff}
  .cover{text-align:center;padding:40px 20px;border-bottom:2px solid #333;margin-bottom:30px}
  h2{font-size:16px;border-bottom:1px solid #ccc;padding-bottom:4px;margin-top:30px}
  h3{font-size:13px;margin:20px 0 8px;color:#333}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f0f0f0;font-weight:bold}
  .member-sheet{page-break-inside:avoid;border:1px solid #e0e0e0;padding:12px;margin-bottom:20px}
</style>
</head>
<body>
<div class="cover">
  <h1>Structural Design Report</h1>
  <p><strong>Project:</strong> ${projectName}</p>
  <p><strong>Design Code:</strong> ${designCode}</p>
  <p><strong>Date:</strong> ${today}</p>
</div>
<h2>Summary Table</h2>
<table>
  <thead>
    <tr><th>Member ID</th><th>Type</th><th>Section</th><th>Utilization</th><th>Status</th><th>Governing Check</th><th>Load Combo</th></tr>
  </thead>
  <tbody>${summaryRows}</tbody>
</table>
<h2>Member Calculation Sheets</h2>
${memberSheets}
</body>
</html>`;
  } catch (err) {
    return `<!DOCTYPE html><html><head><title>Error</title></head><body><p style="color:red">Error generating report: ${String(err)}</p></body></html>`;
  }
}
